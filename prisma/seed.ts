import { PrismaPg } from '@prisma/adapter-pg'
import { AllowanceType, EmploymentStatus, PrismaClient, Role } from '@prisma/client'
import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

const adapter = new PrismaPg(pool)

const prisma = new PrismaClient({
  adapter,
})

async function main() {
  console.log('🌱 Seeding database...\n')

  // ============================================================================
  // SYSTEM CONFIG
  // ============================================================================
  console.log('📋 Creating system configuration...')
  const systemConfig = await prisma.systemConfig.upsert({
    where: { id: 'default-config' },
    update: {},
    create: {
      id: 'default-config',
      companyName: 'Ghana Payroll Corp',
      companyRegistration: 'GH-2024-001',
      taxId: 'P0000000000',
      currency: 'GHS',
      fiscalYearStart: 1,
      fiscalYearEnd: 12,
    },
  })
  console.log(`✅ System Config: ${systemConfig.companyName}\n`)

  // ============================================================================
  // USERS
  // ============================================================================
  console.log('👥 Creating users...')

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@payroll.com' },
    update: {},
    create: {
      email: 'admin@payroll.com',
      firstName: 'Admin',
      lastName: 'User',
      role: Role.ADMIN,
      status: 'active',
    },
  })
  console.log(`✅ Admin: ${adminUser.email}`)

  const preparerUser = await prisma.user.upsert({
    where: { email: 'preparer@payroll.com' },
    update: {},
    create: {
      email: 'preparer@payroll.com',
      firstName: 'James',
      lastName: 'Preparer',
      role: Role.PREPARER,
      status: 'active',
    },
  })
  console.log(`✅ Preparer: ${preparerUser.email}`)

  const approverUser = await prisma.user.upsert({
    where: { email: 'approver@payroll.com' },
    update: {},
    create: {
      email: 'approver@payroll.com',
      firstName: 'Mary',
      lastName: 'Approver',
      role: Role.APPROVER,
      status: 'active',
    },
  })
  console.log(`✅ Approver: ${approverUser.email}\n`)

  const auditorUser = await prisma.user.upsert({
    where: { email: 'auditor@payroll.com' },
    update: {},
    create: {
      email: 'auditor@payroll.com',
      firstName: 'Abena',
      lastName: 'Auditor',
      role: Role.AUDITOR,
      status: 'active',
    },
  })
  console.log(`Auditor: ${auditorUser.email}`)

  // ============================================================================
  // DEPARTMENTS
  // ============================================================================
  console.log('🏢 Creating departments...')

  const depts = await Promise.all([
    prisma.department.upsert({
      where: { code: 'IT' },
      update: {},
      create: { name: 'Information Technology', code: 'IT' },
    }),
    prisma.department.upsert({
      where: { code: 'HR' },
      update: {},
      create: { name: 'Human Resources', code: 'HR' },
    }),
    prisma.department.upsert({
      where: { code: 'FIN' },
      update: {},
      create: { name: 'Finance', code: 'FIN' },
    }),
    prisma.department.upsert({
      where: { code: 'OPS' },
      update: {},
      create: { name: 'Operations', code: 'OPS' },
    }),
  ])
  console.log(`✅ Created ${depts.length} departments\n`)

  // ============================================================================
  // EMPLOYEES
  // ============================================================================
  console.log('👔 Creating employees...')

  const employees = await Promise.all([
    prisma.employee.upsert({
      where: { email: 'kofi.asante@payroll.com' },
      update: {},
      create: {
        firstName: 'Kofi',
        lastName: 'Asante',
        email: 'kofi.asante@payroll.com',
        employeeId: 'EMP001',
        ssnit_number: 'C123456789A01',
        dateOfBirth: new Date('1990-05-15'),
        gender: 'M',
        phone: '+233501234567',
        address: '123 Independence Ave',
        city: 'Accra',
        department: 'IT',
        designation: 'Senior Developer',
        startDate: new Date('2022-01-15'),
        employmentStatus: EmploymentStatus.ACTIVE,
        createdBy: adminUser.id,
        bankName: 'GCB Bank',
        accountNumber: '1234567890',
        accountName: 'Kofi Asante',
      },
    }),
    prisma.employee.upsert({
      where: { email: 'ama.osei@payroll.com' },
      update: {},
      create: {
        firstName: 'Ama',
        lastName: 'Osei',
        email: 'ama.osei@payroll.com',
        employeeId: 'EMP002',
        ssnit_number: 'C234567890A01',
        dateOfBirth: new Date('1992-08-22'),
        gender: 'F',
        phone: '+233502234567',
        address: '456 Kwame Nkrumah Ave',
        city: 'Kumasi',
        department: 'HR',
        designation: 'HR Manager',
        startDate: new Date('2021-06-01'),
        employmentStatus: EmploymentStatus.ACTIVE,
        createdBy: adminUser.id,
        bankName: 'Zenith Bank',
        accountNumber: '0987654321',
        accountName: 'Ama Osei',
      },
    }),
    prisma.employee.upsert({
      where: { email: 'yaw.mensah@payroll.com' },
      update: {},
      create: {
        firstName: 'Yaw',
        lastName: 'Mensah',
        email: 'yaw.mensah@payroll.com',
        employeeId: 'EMP003',
        ssnit_number: 'C345678901A01',
        dateOfBirth: new Date('1988-03-10'),
        gender: 'M',
        phone: '+233503234567',
        address: '789 High Street',
        city: 'Takoradi',
        department: 'Finance',
        designation: 'Accountant',
        startDate: new Date('2020-02-01'),
        employmentStatus: EmploymentStatus.ACTIVE,
        createdBy: adminUser.id,
        bankName: 'ADB Bank',
        accountNumber: '5555666677',
        accountName: 'Yaw Mensah',
      },
    }),
    prisma.employee.upsert({
      where: { email: 'esi.boateng@payroll.com' },
      update: {},
      create: {
        firstName: 'Esi',
        lastName: 'Boateng',
        email: 'esi.boateng@payroll.com',
        employeeId: 'EMP004',
        ssnit_number: 'C456789012A01',
        dateOfBirth: new Date('1995-11-30'),
        gender: 'F',
        phone: '+233504234567',
        address: '321 Ridge Road',
        city: 'Cape Coast',
        department: 'Operations',
        designation: 'Operations Officer',
        startDate: new Date('2023-03-15'),
        employmentStatus: EmploymentStatus.ACTIVE,
        createdBy: adminUser.id,
        bankName: 'Ecobank',
        accountNumber: '4444555566',
        accountName: 'Esi Boateng',
      },
    }),
  ])

  console.log(`✅ Created ${employees.length} employees\n`)

  // ============================================================================
  // SALARY CONFIGURATIONS
  // ============================================================================
  console.log('💰 Creating salary configurations...')

  const salaryConfigs = await Promise.all([
    prisma.salaryConfiguration.create({
      data: {
        employeeId: employees[0].id,
        baseSalary: 5000,
        effectiveFrom: new Date('2024-01-01'),
        createdBy: preparerUser.id,
      },
    }),
    prisma.salaryConfiguration.create({
      data: {
        employeeId: employees[1].id,
        baseSalary: 4500,
        effectiveFrom: new Date('2024-01-01'),
        createdBy: preparerUser.id,
      },
    }),
    prisma.salaryConfiguration.create({
      data: {
        employeeId: employees[2].id,
        baseSalary: 4000,
        effectiveFrom: new Date('2024-01-01'),
        createdBy: preparerUser.id,
      },
    }),
    prisma.salaryConfiguration.create({
      data: {
        employeeId: employees[3].id,
        baseSalary: 3500,
        effectiveFrom: new Date('2024-01-01'),
        createdBy: preparerUser.id,
      },
    }),
  ])

  console.log(`✅ Created ${salaryConfigs.length} salary configurations\n`)

  // ============================================================================
  // ALLOWANCES
  // ============================================================================
  console.log('🎁 Creating allowances...')

  const allowances = await Promise.all([
    prisma.allowance.create({
      data: {
        employeeId: employees[0].id,
        type: AllowanceType.HOUSING,
        amount: 500,
        description: 'Housing allowance',
      },
    }),
    prisma.allowance.create({
      data: {
        employeeId: employees[0].id,
        type: AllowanceType.TRANSPORT,
        amount: 200,
        description: 'Transport allowance',
      },
    }),
    prisma.allowance.create({
      data: {
        employeeId: employees[1].id,
        type: AllowanceType.MEAL,
        amount: 150,
        description: 'Meal allowance',
      },
    }),
    prisma.allowance.create({
      data: {
        employeeId: employees[2].id,
        type: AllowanceType.HOUSING,
        amount: 400,
        description: 'Housing allowance',
      },
    }),
  ])

  console.log(`✅ Created ${allowances.length} allowances\n`)

  // ============================================================================
  // TAX CONFIGURATION (GHANA 2024)
  // ============================================================================
  console.log('📊 Creating tax configuration (Ghana 2024)...')

  const taxConfig = await prisma.taxConfiguration.upsert({
    where: {
      year_month: {
        year: 2024,
        month: 0,
      },
    },
    update: {},
    create: {
      year: 2024,
      month: 0,
      payeThreshold: 365, // Monthly threshold
      payeBrackets: JSON.stringify([
        { min: 0, max: 365, rate: 0 },
        { min: 365, max: 730, rate: 0.05 },
        { min: 730, max: 2920, rate: 0.1 },
        { min: 2920, max: 10000, rate: 0.175 },
        { min: 10000, max: 99999999, rate: 0.25 },
      ]),
      ssnitEmployeeRate: 5.5,
      ssnitEmployerRate: 13,
      personalRelief: 365,
      spouseExemption: 0,
      childExemption: 0,
      updatedBy: preparerUser.id,
      // Seeded configuration counts as already reviewed by the approver
      approvedAt: new Date(),
      approvedById: approverUser.id,
    },
  })

  console.log(`✅ Tax Config for ${taxConfig.year}: PAYE & SSNIT rates set\n`)

  // ============================================================================
  // SUMMARY
  // ============================================================================
  console.log('════════════════════════════════════════════════════════════')
  console.log('✅ Database seeding completed successfully!')
  console.log('════════════════════════════════════════════════════════════\n')

  console.log('📝 TEST ACCOUNTS (passwordless — login via OTP):')
  console.log('─────────────────────────────────────────────────────────')
  console.log('Admin:    admin@payroll.com')
  console.log('Preparer: preparer@payroll.com')
  console.log('Approver: approver@payroll.com')
  console.log('─────────────────────────────────────────────────────────\n')

  console.log('📊 DATABASE SUMMARY:')
  console.log(`  • Users: 3`)
  console.log(`  • Employees: 4`)
  console.log(`  • Departments: 4`)
  console.log(`  • Salary Configs: 4`)
  console.log(`  • Allowances: 4`)
  console.log(`  • Tax Configuration: Configured for Ghana 2024\n`)
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error('❌ Seeding failed:', e)
    await prisma.$disconnect()
    process.exit(1)
  })
