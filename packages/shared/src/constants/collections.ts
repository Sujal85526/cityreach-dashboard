/** Firestore collection names. Import these; never hard-code collection strings. */
export const COLLECTIONS = {
  branches: 'branches',
  users: 'users',
  shifts: 'shifts',
  attendance: 'attendance',
  attendancePhotos: 'attendancePhotos',
  leaveRequests: 'leaveRequests',
  documents: 'documents',
  documentChunks: 'documentChunks',
  payslips: 'payslips',
  expenses: 'expenses',
  salesDays: 'salesDays',
  purchaseOrders: 'purchaseOrders',
  candidates: 'candidates',
  incidents: 'incidents',
  handovers: 'handovers',
  checklistTemplates: 'checklistTemplates',
  checklistRuns: 'checklistRuns',
  temperatureLogs: 'temperatureLogs',
  inspections: 'inspections',
  equipment: 'equipment',
  maintenance: 'maintenance',
  feedback: 'feedback',
  training: 'training',
  goals: 'goals',
  rota: 'rota',
  swapRequests: 'swapRequests',
  tasks: 'tasks',
  inventoryItems: 'inventoryItems',
  stockMovements: 'stockMovements',
  suppliers: 'suppliers',
  notifications: 'notifications',
  activity: 'activity',
  performance: 'performance',
  reports: 'reports',
} as const

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS]

export const ROLES = ['owner', 'manager', 'employee'] as const
export type Role = (typeof ROLES)[number]

/** Owners can do everything a manager can, plus run several branches. */
export const isManagerRole = (role: Role) => role === 'manager' || role === 'owner'
