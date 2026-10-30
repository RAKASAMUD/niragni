# Kiro task: SDK/model audit and device protocol

Read docs/superpowers/plans/2026-10-28-qvac-spike.md and baseline .context/baca-bara-codex-handoff-json-sebagai/outputs/Bara-PRD.md, Bara-Verifikasi.md. Read .skills/orchestration/SKILL.md, .skills/github-test-authorization/SKILL.md, .skills/verification-before-completion/SKILL.md; follow injected Orca lifecycle instructions.

Own only docs/spike/qvac-audit.md, docs/spike/offline-test-protocol.md, scripts/device/** and work/reports/kiro-audit.md. Do not edit app/config/plan/git or create agents. Other worker owns apps/qvac-spike.

Research primary QVAC docs, npm package metadata and model repositories. Pin a feasible SDK version and model+matching projector candidate, with exact URLs/revisions, weights/projector licenses, bytes and available SHA256/LFS hashes. Evaluate SmolVLM2 500M first and VisionPsy Nano as alternative; do not infer Mali GPU support. Report SDK/bare/Expo compatibility and Windows native-build restrictions, not just Android OS support. Prefer free local tooling. Do not download model weights or install SDK/toolchains. Clearly separate metadata verification from device evidence.

Create a read-only PowerShell device inventory script accepting explicit adb path and serial, collecting OS/HyperOS/build/ABI, physical meminfo (excluding memory extension), free app storage and thermal/battery baseline without identifiers/personal data. Write a protocol for 10 actual cold-start text+photo offline runs, warm latency, total completion target <10 s, network checks, input/photo sensitivity, memory, cancellation and error evidence. Photos/reviewers/user testing deferred. No device needed now.

Write concise findings promptly then notify coordinator via Orca so application worker can consume pinned interfaces. Acceptance: sources+dates, exact version and license evidence or explicit blocker, download estimates, script syntax verification and protocol distinguishing documented versus tested support. Finish report with commands/results/gaps and worker_done exact lifecycle IDs. Indonesian summary preferred.
