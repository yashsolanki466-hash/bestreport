export function toTemplateContext(data) {
    return {
        ...data,
        pi_name: data.project_pi,
        date: data.report_date,
        genome: data.reference_organism
    };
}
//# sourceMappingURL=reportModel.js.map