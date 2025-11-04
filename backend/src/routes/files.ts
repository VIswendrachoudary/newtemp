import { Router } from 'express'
import multer from 'multer'
import { authenticateToken, AuthenticatedRequest } from '@/middleware/auth'
import { requireOwnership } from '@/middleware/auth'
import { uploadFileController } from '@/controllers/uploadController'
import { fileController } from '@/controllers/fileController'
import { uploadRateLimiter } from '@/middleware/rateLimiter'
import { logger } from '@/utils/logger'

const router = Router()

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max file size
    files: 10, // Max 10 files at once
  },
  fileFilter: (req, file, cb) => {
    // Check file extension
    const allowedExtensions = ['.fasta', '.fa', '.fas', '.fastq', '.fq', '.sam', '.bam']
    const fileExtension = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'))

    if (allowedExtensions.includes(fileExtension)) {
      cb(null, true)
    } else {
      cb(new Error(`File type ${fileExtension} not allowed. Allowed types: ${allowedExtensions.join(', ')}`))
    }
  },
})

// Upload files
/**
 * @swagger
 * /api/files/upload:
 *   post:
 *     summary: Upload one or more sequence files
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [files, projectId]
 *             properties:
 *               files:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *               projectId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Files uploaded successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Authentication required
 */
router.post(
  '/upload',
  authenticateToken,
  uploadRateLimiter,
  upload.array('files', 10),
  uploadFileController.uploadFiles
)

// Validate file without uploading
/**
 * @swagger
 * /api/files/validate:
 *   post:
 *     summary: Validate a file without uploading it
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: File validation results
 */
router.post(
  '/validate',
  authenticateToken,
  upload.single('file'),
  uploadFileController.validateFile
)

// Get file metadata
/**
 * @swagger
 * /api/files/{id}:
 *   get:
 *     summary: Get file metadata
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: File metadata retrieved successfully
 *       404:
 *         description: File not found
 */
router.get(
  '/:id',
  authenticateToken,
  requireOwnership('file'),
  fileController.getFile
)

// Download file
/**
 * @swagger
 * /api/files/{id}/download:
 *   get:
 *     summary: Download a file
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: File downloaded successfully
 *       404:
 *         description: File not found
 */
router.get(
  '/:id/download',
  authenticateToken,
  requireOwnership('file'),
  fileController.downloadFile
)

// Delete file
/**
 * @swagger
 * /api/files/{id}:
 *   delete:
 *     summary: Delete a file
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: File deleted successfully
 *       404:
 *         description: File not found
 */
router.delete(
  '/:id',
  authenticateToken,
  requireOwnership('file'),
  fileController.deleteFile
)

// Get file statistics
/**
 * @swagger
 * /api/files/{id}/stats:
 *   get:
 *     summary: Get file processing statistics
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: File statistics retrieved successfully
 */
router.get(
  '/:id/stats',
  authenticateToken,
  requireOwnership('file'),
  fileController.getFileStats
)

// Get files for a project
/**
 * @swagger
 * /api/files/project/{projectId}:
 *   get:
 *     summary: Get all files for a project
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: fileType
 *         schema:
 *           type: string
 *           enum: [fasta, fastq, sam, bam]
 *     responses:
 *       200:
 *         description: Project files retrieved successfully
 */
router.get(
  '/project/:projectId',
  authenticateToken,
  requireOwnership('project'),
  fileController.getProjectFiles
)

// Update file metadata
/**
 * @swagger
 * /api/files/{id}:
 *   put:
 *     summary: Update file metadata
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               filename:
 *                 type: string
 *               metadata:
 *                 type: object
 *     responses:
 *       200:
 *         description: File metadata updated successfully
 */
router.put(
  '/:id',
  authenticateToken,
  requireOwnership('file'),
  fileController.updateFile
)

export default router