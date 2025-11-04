import { Request, Response } from 'express'
import { promises as fs } from 'fs'
import path from 'path'
import crypto from 'crypto'
import { parse as parseFASTA } from 'bioinformatics-parser'
import { prisma } from '@/database'
import { config } from '@/config'
import { logger } from '@/utils/logger'
import { socketEmit } from '@/socket'
import { AuthenticatedRequest } from '@/middleware/auth'
import { fileValidator } from '@/services/fileValidator'
import { storageService } from '@/services/storageService'

export const uploadFileController = {
  async uploadFiles(req: AuthenticatedRequest, res: Response) {
    try {
      const files = req.files as Express.Multer.File[]
      const { projectId } = req.body

      if (!files || files.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No files provided',
          code: 'FILE_001',
        })
      }

      if (!projectId) {
        return res.status(400).json({
          success: false,
          error: 'Project ID required',
          code: 'FILE_002',
        })
      }

      // Verify user has access to the project
      const project = await prisma.project.findFirst({
        where: {
          id: projectId,
          OR: [
            { ownerId: req.user!.id },
            {
              collaborators: {
                some: { userId: req.user!.id }
              }
            },
            { isPublic: true }
          ]
        },
      })

      if (!project) {
        return res.status(403).json({
          success: false,
          error: 'Access denied to this project',
          code: 'FILE_003',
        })
      }

      const uploadResults = []
      const uploadId = crypto.randomUUID()

      // Emit upload started event
      socketEmit.uploadProgress(uploadId, {
        totalFiles: files.length,
        processedFiles: 0,
        status: 'started',
      })

      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const fileResult = await this.processFileUpload(
          file,
          projectId,
          req.user!.id,
          uploadId,
          i + 1,
          files.length
        )
        uploadResults.push(fileResult)

        // Emit progress update
        socketEmit.uploadProgress(uploadId, {
          totalFiles: files.length,
          processedFiles: i + 1,
          currentFile: file.originalname,
          status: 'processing',
        })
      }

      // Emit completion event
      socketEmit.uploadCompleted(uploadId, {
        totalFiles: files.length,
        successfulFiles: uploadResults.filter(r => r.success).length,
        failedFiles: uploadResults.filter(r => !r.success).length,
        files: uploadResults,
      })

      logger.logFile('files_uploaded', undefined, {
        userId: req.user!.id,
        projectId,
        fileCount: files.length,
        successfulFiles: uploadResults.filter(r => r.success).length,
      })

      res.status(201).json({
        success: true,
        data: {
          uploadId,
          files: uploadResults,
        },
        message: `Successfully uploaded ${uploadResults.filter(r => r.success).length} of ${files.length} files`,
      })
    } catch (error) {
      logger.error('File upload error:', error)
      res.status(500).json({
        success: false,
        error: 'File upload failed',
        code: 'FILE_004',
      })
    }
  },

  async processFileUpload(
    file: Express.Multer.File,
    projectId: string,
    userId: string,
    uploadId: string,
    fileIndex: number,
    totalFiles: number
  ) {
    try {
      const startTime = Date.now()

      // Generate unique filename
      const fileExtension = path.extname(file.originalname).toLowerCase()
      const uniqueFilename = `${Date.now()}_${crypto.randomBytes(8).toString('hex')}${fileExtension}`
      const filePath = path.join(config.upload.dir, uniqueFilename)

      // Validate file before processing
      const validationResult = await fileValidator.validateFile(file.buffer, file.originalname)
      if (!validationResult.isValid) {
        return {
          success: false,
          originalName: file.originalname,
          error: validationResult.errors.join(', '),
          code: 'FILE_005',
        }
      }

      // Save file to disk
      await fs.writeFile(filePath, file.buffer)

      // Calculate file checksum
      const checksum = crypto.createHash('sha256').update(file.buffer).digest('hex')

      // Check for duplicate files in project
      const existingFile = await prisma.uploadedFile.findFirst({
        where: {
          projectId,
          checksum,
        },
      })

      if (existingFile) {
        // Remove the uploaded file since it's a duplicate
        await fs.unlink(filePath)

        return {
          success: false,
          originalName: file.originalname,
          error: 'File already exists in this project',
          code: 'FILE_006',
          existingFileId: existingFile.id,
        }
      }

      // Detect file type and extract metadata
      const fileType = this.detectFileType(file.originalname, file.buffer)
      const metadata = await this.extractFileMetadata(file.buffer, fileType)

      // Create database record
      const uploadedFile = await prisma.uploadedFile.create({
        data: {
          projectId,
          filename: uniqueFilename,
          originalName: file.originalname,
          filePath,
          fileSize: file.size,
          fileType,
          uploadStatus: 'COMPLETED',
          checksum,
          metadata,
          uploadedBy: userId,
        },
      })

      // Upload to storage service (if configured)
      if (config.storage.minio.endpoint) {
        try {
          await storageService.uploadFile(uniqueFilename, file.buffer, {
            'Content-Type': this.getContentType(fileType),
            'X-Upload-ID': uploadId,
            'X-User-ID': userId,
          })
        } catch (storageError) {
          logger.error('Storage upload failed:', storageError)
          // Don't fail the upload if storage fails, just log it
        }
      }

      const processingTime = Date.now() - startTime

      logger.logFile('file_uploaded', uploadedFile.id, {
        originalName: file.originalname,
        fileType,
        fileSize: file.size,
        processingTime,
        projectId,
        userId,
      })

      return {
        success: true,
        file: {
          id: uploadedFile.id,
          filename: uploadedFile.filename,
          originalName: uploadedFile.originalName,
          fileSize: uploadedFile.fileSize,
          fileType: uploadedFile.fileType,
          metadata: uploadedFile.metadata,
          createdAt: uploadedFile.createdAt,
        },
        processingTime,
      }
    } catch (error) {
      logger.error('Error processing file upload:', error)
      return {
        success: false,
        originalName: file.originalname,
        error: error instanceof Error ? error.message : 'Unknown error',
        code: 'FILE_007',
      }
    }
  },

  async validateFile(req: AuthenticatedRequest, res: Response) {
    try {
      const file = req.file as Express.Multer.File

      if (!file) {
        return res.status(400).json({
          success: false,
          error: 'No file provided',
          code: 'FILE_008',
        })
      }

      const validationResult = await fileValidator.validateFile(file.buffer, file.originalname)

      logger.logFile('file_validated', undefined, {
        originalName: file.originalname,
        isValid: validationResult.isValid,
        errors: validationResult.errors,
        userId: req.user!.id,
      })

      res.json({
        success: true,
        data: {
          isValid: validationResult.isValid,
          errors: validationResult.errors,
          warnings: validationResult.warnings,
          fileStats: validationResult.fileStats,
        },
      })
    } catch (error) {
      logger.error('File validation error:', error)
      res.status(500).json({
        success: false,
        error: 'File validation failed',
        code: 'FILE_009',
      })
    }
  },

  detectFileType(filename: string, buffer: Buffer): 'FASTA' | 'FASTQ' | 'SAM' | 'BAM' {
    const extension = path.extname(filename).toLowerCase()

    // Check by extension first
    switch (extension) {
      case '.fasta':
      case '.fa':
      case '.fas':
        return 'FASTA'
      case '.fastq':
      case '.fq':
        return 'FASTQ'
      case '.sam':
        return 'SAM'
      case '.bam':
        return 'BAM'
    }

    // Check by content if extension is ambiguous
    const content = buffer.toString('utf8', 0, Math.min(1024, buffer.length))

    if (content.startsWith('@')) {
      return 'FASTQ'
    } else if (content.startsWith('>')) {
      return 'FASTA'
    } else if (content.includes('@SQ') || content.includes('@HD')) {
      return 'SAM'
    } else if (buffer.length > 4 && buffer.readUInt32BE(0) === 0x1F8B08) {
      // Check if it's gzipped, could be compressed BAM
      return 'BAM'
    }

    // Default to FASTA if we can't determine
    return 'FASTA'
  },

  async extractFileMetadata(buffer: Buffer, fileType: string) {
    const metadata: any = {
      uploadDate: new Date().toISOString(),
      fileType,
    }

    try {
      switch (fileType) {
        case 'FASTA':
          metadata.fastaMetadata = await this.extractFASTAMetadata(buffer)
          break
        case 'FASTQ':
          metadata.fastqMetadata = await this.extractFASTQMetadata(buffer)
          break
        case 'SAM':
          metadata.samMetadata = await this.extractSAMMetadata(buffer)
          break
        case 'BAM':
          metadata.bamMetadata = await this.extractBAMMetadata(buffer)
          break
      }
    } catch (error) {
      logger.warn('Error extracting file metadata:', error)
      metadata.extractionError = error instanceof Error ? error.message : 'Unknown error'
    }

    return metadata
  },

  async extractFASTAMetadata(buffer: Buffer) {
    const content = buffer.toString('utf8')
    const lines = content.split('\n')

    let sequenceCount = 0
    let totalLength = 0
    let gcCount = 0
    const lengthHistogram: { [key: string]: number } = {}

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()

      if (line.startsWith('>')) {
        sequenceCount++
        const sequence = []
        i++ // Move to sequence line

        // Collect sequence lines until next header or end
        while (i < lines.length && !lines[i].startsWith('>')) {
          const seqLine = lines[i].trim()
          if (seqLine) {
            sequence.push(seqLine)
          }
          i++
        }
        i-- // Adjust for loop increment

        const fullSequence = sequence.join('')
        const seqLength = fullSequence.length

        if (seqLength > 0) {
          totalLength += seqLength

          // Count GC content
          gcCount += (fullSequence.match(/[GCgc]/g) || []).length

          // Length histogram
          const lengthRange = this.getLengthRange(seqLength)
          lengthHistogram[lengthRange] = (lengthHistogram[lengthRange] || 0) + 1
        }
      }
    }

    return {
      sequenceCount,
      totalLength,
      averageLength: sequenceCount > 0 ? Math.round(totalLength / sequenceCount) : 0,
      gcContent: totalLength > 0 ? Number(((gcCount / totalLength) * 100).toFixed(2)) : 0,
      lengthHistogram,
      longestSequence: Math.max(...Object.values(lengthHistogram).map((range: string) => parseInt(range.split('-')[1]))),
      shortestSequence: Math.min(...Object.keys(lengthHistogram).map((range: string) => parseInt(range.split('-')[0]))),
    }
  },

  async extractFASTQMetadata(buffer: Buffer) {
    const content = buffer.toString('utf8')
    const lines = content.split('\n')

    let readCount = 0
    let totalLength = 0
    let totalQuality = 0
    let gcCount = 0
    const qualityDistribution: { [key: string]: number } = {}

    for (let i = 0; i < lines.length; i += 4) {
      if (i + 3 >= lines.length) break

      const header = lines[i]
      const sequence = lines[i + 1]?.trim() || ''
      const plusLine = lines[i + 2]
      const qualityLine = lines[i + 3]?.trim() || ''

      if (header.startsWith('@') && plusLine === '+') {
        readCount++
        const seqLength = sequence.length

        if (seqLength > 0 && seqLength === qualityLine.length) {
          totalLength += seqLength

          // Count GC content
          gcCount += (sequence.match(/[GCgc]/g) || []).length

          // Calculate average quality score
          const qualitySum = qualityLine.split('').reduce((sum, char) => {
            return sum + (char.charCodeAt(0) - 33) // Phred+33 encoding
          }, 0)
          totalQuality += qualitySum / seqLength

          // Quality distribution
          const avgQuality = Math.round(qualitySum / seqLength)
          const qualityRange = this.getQualityRange(avgQuality)
          qualityDistribution[qualityRange] = (qualityDistribution[qualityRange] || 0) + 1
        }
      }
    }

    return {
      readCount,
      totalLength,
      averageLength: readCount > 0 ? Math.round(totalLength / readCount) : 0,
      averageQuality: readCount > 0 ? Number((totalQuality / readCount).toFixed(2)) : 0,
      gcContent: totalLength > 0 ? Number(((gcCount / totalLength) * 100).toFixed(2)) : 0,
      qualityDistribution,
    }
  },

  async extractSAMMetadata(buffer: Buffer) {
    const content = buffer.toString('utf8')
    const lines = content.split('\n')

    const header: any = {}
    let alignmentCount = 0
    let mappedReads = 0

    for (const line of lines) {
      const trimmedLine = line.trim()
      if (!trimmedLine) continue

      if (trimmedLine.startsWith('@')) {
        const [tag, ...rest] = trimmedLine.split('\t')
        const key = tag.substring(1)
        header[key] = rest.join('\t')
      } else {
        alignmentCount++
        const fields = trimmedLine.split('\t')
        if (fields.length >= 4) {
          const flag = parseInt(fields[1])
          // Check if read is mapped (flag 4 means unmapped)
          if ((flag & 4) === 0) {
            mappedReads++
          }
        }
      }
    }

    return {
      header,
      alignmentCount,
      mappedReads,
      unmappedReads: alignmentCount - mappedReads,
      mappingRate: alignmentCount > 0 ? Number(((mappedReads / alignmentCount) * 100).toFixed(2)) : 0,
    }
  },

  async extractBAMMetadata(buffer: Buffer) {
    // BAM files are binary, so we need a BAM parser
    // For now, just return basic info
    return {
      fileSize: buffer.length,
      format: 'BAM (Binary Alignment Map)',
      note: 'Detailed BAM metadata extraction requires BAM parser library',
    }
  },

  getLengthRange(length: number): string {
    if (length < 100) return '0-99'
    if (length < 500) return '100-499'
    if (length < 1000) return '500-999'
    if (length < 5000) return '1000-4999'
    return '5000+'
  },

  getQualityRange(quality: number): string {
    if (quality < 10) return '0-9 (Poor)'
    if (quality < 20) return '10-19 (Low)'
    if (quality < 30) return '20-29 (Good)'
    return '30+ (Excellent)'
  },

  getContentType(fileType: string): string {
    switch (fileType) {
      case 'FASTA':
        return 'text/plain'
      case 'FASTQ':
        return 'text/plain'
      case 'SAM':
        return 'text/plain'
      case 'BAM':
        return 'application/octet-stream'
      default:
        return 'application/octet-stream'
    }
  },
}