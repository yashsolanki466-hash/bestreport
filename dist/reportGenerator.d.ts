interface GeneratorOptions {
    templateDir?: string;
    headless: boolean;
}
interface GenerateOptions {
    inputDir: string;
    outputName: string;
    formats: string[];
    metadata?: {
        projectId?: string;
        piName?: string;
        clientName?: string;
        client_org?: string;
        logo?: string;
        reference_organism?: string;
    };
    template?: string;
    embedImages?: boolean;
}
interface GenerateResult {
    files: Array<{
        path: string;
        size: number;
    }>;
    duration: number;
}
export declare class ReportGenerator {
    private options;
    private browser;
    constructor(options: GeneratorOptions);
    init(): Promise<void>;
    close(): Promise<void>;
    generate(options: GenerateOptions): Promise<GenerateResult>;
    private generatePDF;
    private generateDOCX;
}
export {};
//# sourceMappingURL=reportGenerator.d.ts.map