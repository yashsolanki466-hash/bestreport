export declare function normCol(c: string): string;
export declare function asFloat(v: unknown): number | null;
export declare function asInt(v: unknown): number | null;
/** Resolve a row value using config column alias lists (first match wins). */
export declare function pickColumn(row: Record<string, unknown>, aliases: string[]): unknown;
export declare function findColumn(data: Record<string, unknown>[], aliases: string[]): string | null;
export declare function downsample<T>(points: T[], maxPoints?: number): T[];
//# sourceMappingURL=columnUtils.d.ts.map