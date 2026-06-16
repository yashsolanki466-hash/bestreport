export interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
    projectPath: string;
    projectId?: string;
}
export declare function validateProject(inputDir: string, options?: {
    strict?: boolean;
    parse?: boolean;
}): Promise<ValidationResult>;
export declare function printValidationResult(result: ValidationResult): void;
//# sourceMappingURL=validate.d.ts.map