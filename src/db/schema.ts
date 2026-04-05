import { mysqlTable, int, varchar, timestamp, tinyint, datetime, text } from 'drizzle-orm/mysql-core';
import { relations, sql } from 'drizzle-orm';
import { mysqlEnum } from 'drizzle-orm/mysql-core';

export const users = mysqlTable('users', {
  id: int('id').primaryKey().autoincrement(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: varchar('password', { length: 255 }).notNull(),
  contact: varchar('contact', { length: 20 }),
  image: varchar('image', { length: 255 }).default('/uploads/0.png').notNull(),
  enableTwoFactorAuth : tinyint('enable_two_factor_auth').default(0).notNull(),
  authType: mysqlEnum("auth_type", ["email", "phone"]).default('email').notNull(),
  apiKey: varchar('api_key', { length: 255 }),
  adminId: int('admin_id').default(0),
  designation: varchar('designation', { length: 255 }).default('Educator').notNull(),
  status: tinyint('status').default(1),
  hide: tinyint('hide').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
  passwordUpdateAt: timestamp('password_updated_at'),
});

// export const admins = mysqlTable('admins',{
//   id: int('id').primaryKey().autoincrement(),
//   name: varchar('name', { length: 255 }).notNull(),
//   email: varchar('email', { length: 255 }).notNull().unique(),
//   password: varchar('password', { length: 255 }).notNull(),
//   contact: varchar('contact', { length: 20 }),
//   apiKey: varchar('api_key', { length: 255 }),
//   status: tinyint('status').default(1),
//   hide: tinyint('hide').default(0),
//   createdAt: timestamp('created_at').defaultNow(),
//   updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
  // passwordUpdateAt: timestamp('password_updated_at'),
// })

export const packages = mysqlTable('packages',{
  id: int('id').primaryKey().autoincrement(),
  name: varchar('name', { length: 255 }).notNull(),
  price: int('price').notNull(),
  paymentCurrency: varchar('payment_currency', { length: 10 }).default('USD').notNull(),
  description: varchar('description', { length: 255 }).notNull(),
  highlighted: tinyint('highlighted').default(0),
  status: tinyint('status').default(1),
  hide: tinyint('hide').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
})

export const discounts = mysqlTable('discounts', {
  id: int('id').primaryKey().autoincrement(),
  packageId: int('package_id').notNull(),
  code: varchar('code', { length: 100 }).notNull(),
  discountPrec: int('discount_prec').notNull(),

  maxUses: int('max_uses').default(1), // 0 = unlimited and 1 for 1 time use
  usedCount: int('used_count').default(0),

  expiresAt: timestamp('expires_at'),
  status: tinyint('status').default(1),

  createdAt: timestamp('created_at').defaultNow(),
});

export const leads = mysqlTable('leads', {
  id: int('id').primaryKey().autoincrement(),
  contact: varchar('contact', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const features = mysqlTable('features', {
  id: int('id').primaryKey().autoincrement(),
  name: varchar('name', { length: 100 }).notNull(), // e.g. "recording"
  label: varchar('label', { length: 255 }).notNull(), // "Class Recording"
  type: varchar('type', { length: 50 }).notNull(), // boolean | limit | text
});

export const packageFeatures = mysqlTable('package_features', {
  id: int('id').primaryKey().autoincrement(),
  packageId: int('package_id').notNull(),
  featureId: int('feature_id').notNull(),

  value: varchar('value', { length: 255 }), // flexible
});

export const students = mysqlTable('students', {
  id: int('id').primaryKey().autoincrement(),

  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  password: varchar('password', { length: 255 }).notNull(),
  contact: varchar('contact', { length: 20 }),

  teacherId: varchar('teacher_id', { length: 255 }).notNull(),   // teacher who owns student
  adminId: int('admin_id').default(0),      // institute/admin

  status: tinyint('status').default(1),
  hide: tinyint('hide').default(0),
  allowPasswordUpdate: tinyint('allow_password_update').default(0),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
  passwordUpdateAt: timestamp('password_updated_at'),
});

export const userPackages = mysqlTable('user_packages', {
  id: int('id').primaryKey().autoincrement(),

  userId: varchar('user_id', { length: 255 }).notNull(),
  packageId: int('package_id').notNull(),

  price: int('price').notNull(), // snapshot of price at purchase
  discountId: int('discount_id'), // optional

  startDate: datetime('start_date', { mode: 'date' }).default(sql`CURRENT_TIMESTAMP`),
  endDate: datetime('end_date', { mode: 'date' }),
  renewalCount: int('renewal_count').default(0),

  status: mysqlEnum("status", ["active", "expired", "cancelled", "pending_payment"]).default('pending_payment'),
  // 1 = active, 0 = expired, 2 = cancelled, 3 = pending_payment

  paymentStatus: mysqlEnum("payment_status", ["paid", "unpaid"]).default('unpaid'),
  // 0 = unpaid, 1 = paid

  createdAt: timestamp('created_at').defaultNow(),
});

export const payments = mysqlTable('payments', {
  id: int('id').primaryKey().autoincrement(),

  userId: varchar('user_id', { length: 255 }).notNull(),
  userPackageId: int('user_package_id').notNull(),

  amount: int('amount').notNull(), // in paise (₹100 = 10000)
  currency: varchar('currency', { length: 10 }).default('INR'),

  provider: varchar('provider', { length: 50 }), // razorpay / stripe
  providerPaymentId: varchar('provider_payment_id', { length: 255 }),
  providerOrderId: varchar('provider_order_id', { length: 255 }),
  providerSignature: varchar('provider_signature', { length: 255 }),

  status: mysqlEnum("status", ["pending", "success", "failed"]).default('pending'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

export const classes = mysqlTable('classes', {
  id: int('id').autoincrement().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: varchar('description', { length: 500 }),
  teacherId: varchar('teacher_id', { length: 255 }).notNull(),
  teacherLink : varchar('teacher_link', { length: 255 }),
  studentLink : varchar('student_link', { length: 255 }),

  adminId: int('admin_id').default(0),

  sessionId: varchar('session_id', { length: 255 }).notNull(),
  teacherToken: varchar('teacher_token', { length: 255 }),
  studentToken: varchar('student_token', { length: 255 }),


  isRestricted: tinyint('is_restricted').default(0),
  teacherPresent: tinyint('teacher_present').default(0),
  
  startTime: datetime('start_time', { mode: 'date' }),
  duration: int('duration').default(60), // in minutes
  
  status: mysqlEnum("status", ["scheduled", "started", "completed", "cancelled"]).default('scheduled'),

  hide: tinyint('hide').default(0),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

export const notifications = mysqlTable('notifications', {
  id: int('id').primaryKey().autoincrement(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  message: varchar('message', { length: 500 }).notNull(),
  type: varchar('type', { length: 50 }).default('info'), // info, success, warning, error
  isRead: tinyint('is_read').default(0),
  link: varchar('link', { length: 255 }),
  
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

export const userPackagesRelations = relations(userPackages, ({ one }) => ({
  package: one(packages, {
    fields: [userPackages.packageId],
    references: [packages.id],
  }),
}));

export const contact = mysqlTable('contact', {
  id: int('id').primaryKey().autoincrement(),
  userId: varchar('user_id', { length: 255 }),
  name: varchar('name', { length: 255 }),
  email: varchar('email', { length: 255 }),
  subject: varchar('subject', { length: 255 }).notNull(),
  message: varchar('message', { length: 500 }).notNull(),
  status: mysqlEnum("status", ["unseen", "seen", "connected"]).default('unseen'), 
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

export const support = mysqlTable('support', {
  id: int('id').primaryKey().autoincrement(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  subject: varchar('subject', { length: 255 }).notNull(),
  message: text('message').notNull(),
  status: mysqlEnum("status", ["open", "processing", "closed"]).default('open'), 
  priority: mysqlEnum('priority', ['low', 'medium', 'high']).default('medium'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

export const supportChats = mysqlTable('support_chats', {
  id: int('id').primaryKey().autoincrement(),
  supportId: int('support_id').notNull(),
  status: mysqlEnum("status", ["open", "processing", "closed"]).default('open'),
  message: text('message').notNull(),
  type: mysqlEnum("type", ["user", "admin"]),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const classVisitors = mysqlTable('class_visitors', {
  id: int('id').primaryKey().autoincrement(),
  classId: int('class_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  joinedAt: timestamp('joined_at').defaultNow(),
});