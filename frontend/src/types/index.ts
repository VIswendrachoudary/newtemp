// User and Authentication Types
export interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  orcidId?: string
  institution?: string
  role: UserRole
  createdAt: string
  updatedAt: string
}

export enum UserRole {
  GUEST = 'guest',
  RESEARCHER = 'researcher',
  INSTITUTIONAL_ADMIN = 'institutional_admin',
  SYSTEM_ADMIN = 'system_admin',
}

export interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface RegisterData {
  email: string
  password: string
  firstName: string
  lastName: string
  institution?: string
  orcidId?: string
}

export interface AuthResponse {
  user: User
  accessToken: string
  refreshToken: string
}

// Project Types
export interface Project {
  id: string
  name: string
  description: string
  ownerId: string
  visibility: ProjectVisibility
  createdAt: string
  updatedAt: string
  fileCount: number
  analysisCount: number
  owner: User
  collaborators?: User[]
}

export enum ProjectVisibility {
  PRIVATE = 'private',
  SHARED = 'shared',
  PUBLIC = 'public',
}

export interface CreateProjectData {
  name: string
  description: string
  visibility: ProjectVisibility
}

// File Types
export interface UploadedFile {
  id: string
  projectId: string
  filename: string
  originalName: string
  filePath: string
  fileSize: number
  fileType: FileType
  uploadStatus: UploadStatus
  createdAt: string
  metadata?: FileMetadata
}

export enum FileType {
  FASTA = 'fasta',
  FASTQ = 'fastq',
  SAM = 'sam',
  BAM = 'bam',
}

export enum UploadStatus {
  UPLOADING = 'uploading',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export interface FileMetadata {
  sequenceCount?: number
  totalLength?: number
  averageLength?: number
  qualityScores?: number[]
  gcContent?: number
  processingDate?: string
}

// Analysis Types
export interface AnalysisJob {
  id: string
  projectId: string
  status: AnalysisStatus
  parameters: AnalysisParameters
  results?: AnalysisResults
  startedAt?: string
  completedAt?: string
  errorMessage?: string
  progress?: number
  createdBy: string
}

export enum AnalysisStatus {
  QUEUED = 'queued',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export interface AnalysisParameters {
  qualityThreshold: number
  minLength: number
  maxLength: number
  targetDatabase: string
  confidenceThreshold: number
  maxHits?: number
}

export interface AnalysisResults {
  summary: AnalysisSummary
  species: SpeciesIdentification[]
  biodiversity: BiodiversityMetrics
  quality: QualityAssessment
  visualizations: VisualizationData[]
}

export interface AnalysisSummary {
  totalSequences: number
  identifiedSequences: number
  uniqueSpecies: number
  processingTime: number
  averageConfidence: number
}

export interface SpeciesIdentification {
  id: string
  scientificName: string
  commonName?: string
  taxonomy: TaxonomyInfo
  abundance: number
  relativeAbundance: number
  confidence: number
  hits: SequenceHit[]
}

export interface TaxonomyInfo {
  kingdom: string
  phylum: string
  class: string
  order: string
  family: string
  genus: string
  species: string
}

export interface SequenceHit {
  sequenceId: string
  identity: number
  coverage: number
  eValue: number
  bitScore: number
}

export interface BiodiversityMetrics {
  shannonIndex: number
  shannonIndexCI?: [number, number]
  simpsonIndex: number
  simpsonIndexCI?: [number, number]
  speciesRichness: number
  evenness: number
  dominance: number
}

export interface QualityAssessment {
  averageQuality: number
  qualityDistribution: QualityDistribution[]
  lengthDistribution: LengthDistribution[]
  contaminationFlagged: boolean
  contaminants?: string[]
}

export interface QualityDistribution {
  qualityRange: string
  count: number
  percentage: number
}

export interface LengthDistribution {
  lengthRange: string
  count: number
  percentage: number
}

export interface VisualizationData {
  id: string
  type: VisualizationType
  title: string
  data: any
  config?: any
}

export enum VisualizationType {
  PIE_CHART = 'pie_chart',
  BAR_CHART = 'bar_chart',
  SUNBURST = 'sunburst',
  TREE_MAP = 'tree_map',
  SCATTER_PLOT = 'scatter_plot',
  HEAT_MAP = 'heat_map',
  PHYLOGENETIC_TREE = 'phylogenetic_tree',
  MAP = 'map',
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

// WebSocket Types
export interface WebSocketMessage {
  type: WebSocketMessageType
  payload: any
  timestamp: string
}

export enum WebSocketMessageType {
  ANALYSIS_PROGRESS = 'analysis_progress',
  ANALYSIS_COMPLETED = 'analysis_completed',
  ANALYSIS_FAILED = 'analysis_failed',
  FILE_UPLOAD_PROGRESS = 'file_upload_progress',
  FILE_UPLOAD_COMPLETED = 'file_upload_completed',
  FILE_UPLOAD_FAILED = 'file_upload_failed',
}

// Export Types
export interface ExportOptions {
  format: ExportFormat
  includeMetadata: boolean
  includeVisualizations: boolean
  speciesLevel?: TaxonomyLevel
}

export enum ExportFormat {
  CSV = 'csv',
  TSV = 'tsv',
  EXCEL = 'excel',
  JSON = 'json',
  BIOM = 'biom',
  NEWICK = 'newick',
  PDF = 'pdf',
}

export enum TaxonomyLevel {
  KINGDOM = 'kingdom',
  PHYLUM = 'phylum',
  CLASS = 'class',
  ORDER = 'order',
  FAMILY = 'family',
  GENUS = 'genus',
  SPECIES = 'species',
}

// UI State Types
export interface NotificationState {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  message: string
  timestamp: string
  read: boolean
}

export interface ViewState {
  isLoading: boolean
  error: string | null
  data: any
}

// Form Types
export interface FormErrors {
  [key: string]: string | undefined
}

export interface UploadProgress {
  loaded: number
  total: number
  percentage: number
}

// Filter and Sort Types
export interface ProjectFilters {
  search?: string
  visibility?: ProjectVisibility
  owner?: string
  dateRange?: {
    start: string
    end: string
  }
}

export interface SortOption {
  field: string
  direction: 'asc' | 'desc'
}

export interface SpeciesFilters {
  taxonomyLevel?: TaxonomyLevel
  confidenceRange?: [number, number]
  abundanceRange?: [number, number]
  searchTerm?: string
}