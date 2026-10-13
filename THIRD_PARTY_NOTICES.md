# Third-party notices

Project code and documents use MIT (root LICENSE). This license does not relicense third-party components, recruitment data or personal resumes.

| Component | Version / source | License and included notice |
| --- | --- | --- |
| PDF.js / pdfjs-dist | 6.4.299; https://github.com/mozilla/pdf.js | Apache-2.0; PDFJS-LICENSE.txt |
| fflate | 0.8.3; https://github.com/101arrowz/fflate | MIT; FFLATE-LICENSE.txt |
| Adobe PDF CMaps | Bundled unchanged in pdfjs-dist | Adobe BSD-style terms; cmaps/LICENSE |
| Foxit standard fonts | Bundled unchanged in pdfjs-dist | Foxit BSD-style terms; standard_fonts/LICENSE_FOXIT |
| Liberation Sans | Unmodified 1.07.4, bundled in pdfjs-dist | GPLv2 with font exception; standard_fonts/LICENSE_LIBERATION; full corresponding source included |
| Node.js Windows runtime | Unmodified 24.19.0; https://nodejs.org/ | MIT and bundled third-party notices; docs/licenses/NODE-24.19.0-LICENSE.txt in source, runtime/NODE-LICENSE.txt in Windows distribution |

Relative component notices are in public/autofill/vendor in the repository and autofill/vendor in the extension. JOB-WORKBENCH-LICENSE.txt accompanies standalone distributions. Individual original copyright notices are retained.

The complete Liberation 1.07.4 source archive is font-sources/liberation-fonts-1.07.4.tar.gz beside these notices. SHA-256: ad98b7498dc2992f7f0868f79b65ce4a720a3acdb63ab3f1f1cb6881117a5406. It includes SFD sources, Makefile, FontForge export scripts, AUTHORS, License.txt and COPYING. It accompanies the font files under GPLv2 section 3(a); this is not merely an external download promise. No claim of a reproduced font build is made.

Primary source: https://releases.pagure.org/liberation-fonts/liberation-fonts-1.07.4.tar.gz . PDF.js version/source statement: https://github.com/mozilla/pdf.js/blob/v6.4.299/external/standard_fonts/README.md . A 2.x font is not a drop-in substitute for the bundled 1.07.4 glyph mapping.

Sample resumes are fictional project-authored test documents. Embedded third-party fonts retain their separate document-embedding terms; no Microsoft font file is distributed as a standalone font. Fixture provenance and the distinction from runtime Liberation fonts are documented in docs/FIXTURE_PROVENANCE.md.

Recruitment APIs and company sites retain their own rights and terms. Access to an endpoint is not permission to redistribute its snapshots. No real snapshot or full announcement is included.

The Windows launcher is project-authored C# source in windows/Launcher.cs and is built with the Windows .NET Framework compiler. The Windows package carries Node's exact-version LICENSE unchanged; no runtime executable or personal browser profile is checked into Git.
