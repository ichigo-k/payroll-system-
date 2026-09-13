import { activeCurrency, formatMoney } from "@/lib/currency";
import { TaxBracket, PayrollCalculation } from "./types";

/**
 * Calculate PAYE (Pay As You Earn) tax based on Ghana tax brackets
 */
export function calculatePAYE(
    taxableIncome: number,
    brackets: TaxBracket[]
): number {
    let tax = 0;

    for (const bracket of brackets) {
        if (taxableIncome <= bracket.min) {
            break;
        }

        const incomeInBracket = Math.min(taxableIncome, bracket.max) - bracket.min;
        tax += incomeInBracket * bracket.rate;
    }

    return Math.round(tax * 100) / 100; // Round to 2 decimals
}

/**
 * Calculate SSNIT contributions (Ghana)
 */
export function calculateSSNIT(
    grossIncome: number,
    employeeRate: number,
    employerRate: number
): { employee: number; employer: number } {
    return {
        employee: Math.round((grossIncome * employeeRate) / 100 * 100) / 100,
        employer: Math.round((grossIncome * employerRate) / 100 * 100) / 100,
    };
}

/**
 * Calculate complete payroll for an employee
 */
export function calculatePayroll(
    baseSalary: number,
    allowances: number,
    deductions: number,
    taxBrackets: TaxBracket[],
    ssnitEmployeeRate: number,
    ssnitEmployerRate: number,
    personalRelief: number = 0
): PayrollCalculation {
    // Calculate gross income
    const grossIncome = baseSalary + allowances;

    // Calculate taxable income (gross - reliefs)
    const taxableIncome = Math.max(0, grossIncome - personalRelief);

    // Calculate PAYE
    const paye = calculatePAYE(taxableIncome, taxBrackets);

    // Calculate SSNIT
    const { employee: ssnitEmployee, employer: ssnitEmployer } = calculateSSNIT(
        grossIncome,
        ssnitEmployeeRate,
        ssnitEmployerRate
    );

    // Total deductions = employee deductions + tax + employee SSNIT
    const totalDeductions = deductions + paye + ssnitEmployee;

    // Net pay
    const netPay = grossIncome - totalDeductions;

    return {
        baseSalary,
        allowancesTotal: allowances,
        deductionsTotal: deductions,
        grossIncome,
        taxableIncome,
        paye,
        ssnitEmployee,
        ssnitEmployer,
        totalDeductions,
        netPay: Math.max(0, netPay), // Net pay should not be negative
    };
}

/**
 * Get Ghana 2024 default tax brackets
 */
export function getGhanaTaxBrackets(): TaxBracket[] {
    return [
        { min: 0, max: 365, rate: 0 },
        { min: 365, max: 730, rate: 0.05 },
        { min: 730, max: 2920, rate: 0.1 },
        { min: 2920, max: 10000, rate: 0.175 },
        { min: 10000, max: 99999999, rate: 0.25 },
    ];
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number, currency?: string): string {
    return formatMoney(amount, currency ?? activeCurrency());
}

/**
 * Validate employee data
 */
export function validateEmployeeData(data: {
    firstName?: string;
    lastName?: string;
    email?: string;
    employeeId?: string;
    startDate?: Date;
}): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data.firstName?.trim()) errors.push("First name is required");
    if (!data.lastName?.trim()) errors.push("Last name is required");
    if (!data.email?.trim()) errors.push("Email is required");
    if (!data.employeeId?.trim()) errors.push("Employee ID is required");
    if (!data.startDate) errors.push("Start date is required");

    // Validate email format
    if (data.email && !data.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
        errors.push("Invalid email format");
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

/**
 * Check if user has permission for action
 */
export function hasPermission(
    userRole: string,
    action: string
): boolean {
    const permissions: Record<string, string[]> = {
        ADMIN: ["*"], // All permissions
        PREPARER: [
            "create_employee",
            "edit_employee",
            "configure_salary",
            "configure_tax",
            "submit_payroll",
            "view_payroll",
            "generate_report",
        ],
        APPROVER: [
            "view_payroll",
            "approve_payroll",
            "reject_payroll",
            "view_report",
        ],
        EMPLOYEE: ["view_own_payslip", "download_payslip"],
    };

    const userPermissions = permissions[userRole] || [];

    if (userPermissions.includes("*")) return true;
    return userPermissions.includes(action);
}
