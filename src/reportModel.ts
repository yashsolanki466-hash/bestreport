import type { ProjectData } from './dataParser.js';

/** Template-facing view with legacy aliases used by older templates. */
export interface TemplateContext extends ProjectData {
  pi_name: string;
  date: string;
  genome: string;
}

export function toTemplateContext(data: ProjectData): TemplateContext {
  return {
    ...data,
    pi_name: data.project_pi,
    date: data.report_date,
    genome: data.reference_organism
  };
}
