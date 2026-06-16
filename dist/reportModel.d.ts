import type { ProjectData } from './dataParser.js';
/** Template-facing view with legacy aliases used by older templates. */
export interface TemplateContext extends ProjectData {
    pi_name: string;
    date: string;
    genome: string;
}
export declare function toTemplateContext(data: ProjectData): TemplateContext;
//# sourceMappingURL=reportModel.d.ts.map