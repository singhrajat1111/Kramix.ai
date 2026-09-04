"use client";

import React, { useState } from "react";
import { CandidateProfile, ExperienceLevel } from "@/types/candidate";
import { Briefcase, Building2, Layers, Award, FileText, Plus, X, ArrowRight } from "lucide-react";

interface CandidateFormProps {
  initialProfile: CandidateProfile;
  onSubmit: (profile: CandidateProfile) => void;
}

const EXPERIENCE_LEVELS: ExperienceLevel[] = [
  "Internship / Student",
  "Entry Level (0-2 years)",
  "Mid Level (3-5 years)",
  "Senior Level (5-8 years)",
  "Lead / Principal (8+ years)",
  "Executive / Management",
];

export function CandidateForm({ initialProfile, onSubmit }: CandidateFormProps) {
  const [targetRole, setTargetRole] = useState(initialProfile.targetRole || "");
  const [targetCompany, setTargetCompany] = useState(initialProfile.targetCompanies?.[0] || "");
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>(
    initialProfile.experienceLevel || "Entry Level (0-2 years)"
  );
  const [skills, setSkills] = useState<string[]>(initialProfile.skills || ["Python", "Algorithms"]);
  const [newSkillInput, setNewSkillInput] = useState("");
  const [jobDescription, setJobDescription] = useState(initialProfile.jobDescription || "");
  const [resumeText, setResumeText] = useState(initialProfile.resumeText || "");
  const [resumeFileName, setResumeFileName] = useState(initialProfile.resumeFileName || "");
  const [error, setError] = useState<string | null>(null);

  const handleAddSkill = (e: React.KeyboardEvent | React.MouseEvent) => {
    if ("key" in e && e.key !== "Enter") return;
    e.preventDefault();
    const trimmed = newSkillInput.trim();
    if (trimmed && !skills.includes(trimmed)) {
      setSkills([...skills, trimmed]);
      setNewSkillInput("");
    }
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setSkills(skills.filter((s) => s !== skillToRemove));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setResumeFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setResumeText(text.slice(0, 5000));
      }
    };
    reader.readAsText(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetRole.trim()) {
      setError("Please specify your target job role.");
      return;
    }
    if (!targetCompany.trim()) {
      setError("Please specify your target company.");
      return;
    }

    setError(null);
    const updated: CandidateProfile = {
      ...initialProfile,
      targetRole: targetRole.trim(),
      targetCompanies: [targetCompany.trim()],
      experienceLevel,
      skills,
      jobDescription: jobDescription.trim(),
      resumeText: resumeText.trim(),
      resumeFileName,
      updatedAt: Date.now(),
    };

    onSubmit(updated);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 rounded-xl border border-slate-800 bg-[#0d121d] p-6 shadow-xl">
      <div className="border-b border-slate-800/80 pb-4">
        <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
          <Briefcase className="h-4 w-4 text-brand-400" />
          Candidate Profile & Target Role
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Provide your target positioning. Kramix will research the company&apos;s interview patterns based on this profile.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
          {error}
        </div>
      )}

      {/* Target Role & Company */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
            <Briefcase className="h-3.5 w-3.5 text-brand-400" />
            Target Role <span className="text-rose-400">*</span>
          </label>
          <input
            type="text"
            required
            placeholder="e.g. Machine Learning Engineer"
            value={targetRole}
            onChange={(e) => setTargetRole(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-surface-200/80 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5 text-brand-400" />
            Target Company <span className="text-rose-400">*</span>
          </label>
          <input
            type="text"
            required
            placeholder="e.g. Google, Meta, or Stripe"
            value={targetCompany}
            onChange={(e) => setTargetCompany(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-surface-200/80 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
      </div>

      {/* Experience Level & Skills */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-brand-400" />
            Experience Level
          </label>
          <select
            value={experienceLevel}
            onChange={(e) => setExperienceLevel(e.target.value as ExperienceLevel)}
            className="w-full rounded-lg border border-slate-700 bg-surface-200/80 px-3.5 py-2.5 text-sm text-slate-100 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            {EXPERIENCE_LEVELS.map((lvl) => (
              <option key={lvl} value={lvl} className="bg-slate-900 text-slate-100">
                {lvl}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
            <Award className="h-3.5 w-3.5 text-brand-400" />
            Technical & Domain Skills
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. PyTorch, System Design..."
              value={newSkillInput}
              onChange={(e) => setNewSkillInput(e.target.value)}
              onKeyDown={handleAddSkill}
              className="flex-1 rounded-lg border border-slate-700 bg-surface-200/80 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <button
              type="button"
              onClick={handleAddSkill}
              className="rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 text-xs font-medium text-slate-200 flex items-center gap-1 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </button>
          </div>
          {skills.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {skills.map((s) => (
                <span
                  key={s}
                  className="inline-flex items-center gap-1 rounded-md bg-brand-500/15 border border-brand-500/30 px-2 py-0.5 text-xs text-brand-300"
                >
                  {s}
                  <button
                    type="button"
                    onClick={() => handleRemoveSkill(s)}
                    className="hover:text-rose-400 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Optional: Job Description */}
      <div>
        <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 text-slate-400" />
            Target Job Description (Optional)
          </span>
          <span className="text-[11px] text-slate-400">Pastes or summaries</span>
        </label>
        <textarea
          rows={3}
          placeholder="Paste requirements or bullet points from the job posting to tailor questions..."
          value={jobDescription}
          onChange={(e) => setJobDescription(e.target.value)}
          className="w-full rounded-lg border border-slate-700 bg-surface-200/80 p-3 text-xs text-slate-100 placeholder-slate-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>

      {/* Optional: Resume Upload / Text */}
      <div>
        <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 text-slate-400" />
            Resume Summary or File (Optional)
          </span>
          {resumeFileName && <span className="text-[11px] text-brand-400">{resumeFileName}</span>}
        </label>
        <div className="flex flex-col sm:flex-row gap-3">
          <textarea
            rows={2}
            placeholder="Paste your resume highlights or upload a text/markdown file..."
            value={resumeText}
            onChange={(e) => setResumeText(e.target.value)}
            className="flex-1 rounded-lg border border-slate-700 bg-surface-200/80 p-3 text-xs text-slate-100 placeholder-slate-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <div className="flex flex-col justify-center">
            <label className="cursor-pointer inline-flex items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-700 px-4 py-2.5 text-xs font-medium text-slate-200 transition-colors">
              <span>Upload File</span>
              <input type="file" accept=".txt,.md,.json" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 hover:bg-brand-500 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-500/25 transition-all hover:translate-x-0.5"
        >
          <span>Save & Start Research</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </form>
  );
}
