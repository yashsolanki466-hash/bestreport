# NGS Interim Report — App Source Files

This folder contains **all source files specific to the Wet Lab Interim Report Builder** — the GUI, the EJS report template, and the Word content file.

## Folder Contents

| File / Folder | Purpose |
|---|---|
| `App.tsx` | React GUI — the main wet lab data entry interface |
| `main.tsx` | React entry point (mounts `App` into the DOM) |
| `index.html` | HTML shell for the Vite dev server |
| `index.css` | Tailwind CSS directives |
| `vite.config.ts` | Vite config for this app (port 5174) |
| `wet_lab_notes.docx` | **Edit this in Word** to change method descriptions & conclusions |
| `templates/report_interim.ejs` | EJS template that generates the interim HTML/PDF report |

## Running the App

```bash
# From the project root:
npm run dev:interim
```

Then open → **http://localhost:5174/**

> The main bioinformatics GUI (if you need it) still runs on port 5173 via `npm run dev:gui`.

## Editing Static Content (Word File)

1. Open **`wet_lab_notes.docx`** in Microsoft Word
2. Edit any of the four sections (they are **Word Heading 1** markers):
   - **RNA Isolation Method** — appears in Section 2 of the report
   - **Library Preparation Method** — appears in Section 3
   - **Cluster Generation Method** — continues Section 3
   - **Conclusions** — bullet list in Section 5 (each line starting with `-` = one bullet)
3. Save and close Word
4. Regenerate the report from the GUI — changes are picked up automatically

## Editing the Report Template

To change the layout, styling, or structure of the interim report output, edit:

```
interim_app/templates/report_interim.ejs
```

This is a standard EJS file — all project data is injected as template variables.

## Project Data Folders

Each NGS project's data files live in `interim_projects/<PROJECT_ID>/`:

```
interim_projects/
├── _TEMPLATE/            ← Copy this for new projects
└── NGS_260046_interim/   ← Example project
    ├── wet_lab_notes.docx   (project-specific override — optional)
    ├── wet_lab_data.json    (auto-saved by GUI)
    ├── 260046qubit.xlsx
    ├── 260046RNAQC.xlsx
    ├── 260046.png
    └── tape1.png, tape2.png ...
```

If a project folder has its own `wet_lab_notes.docx`, it takes priority over the app-level one.
