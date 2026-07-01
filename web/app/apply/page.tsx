'use client';

import { useState } from 'react';
import { getBrowserClient } from '@/lib/supabase-browser';
import {
  SUBJECTS, SYLLABUS_OPTIONS, MEDIUM_OPTIONS,
  CONNECTIVITY_OPTIONS, GADGET_OPTIONS
} from '@/lib/constants';

type FormState = {
  full_name: string;
  district: string;
  place: string;
  qualification: string;
  age: string;
  offline_exp: string;
  online_exp: string;
  subject: string[];
  syllabus: string;
  syllabus_other: string;
  medium: string;
  connectivity: string;
  phone: string;
  whatsapp: string;
  email: string;
  gadgets: string[];
  photo: File | null;
};

const initial: FormState = {
  full_name: '', district: '', place: '', qualification: '',
  age: '', offline_exp: '', online_exp: '',
  subject: [], syllabus: '', syllabus_other: '',
  medium: '', connectivity: '',
  phone: '', whatsapp: '', email: '',
  gadgets: [], photo: null
};

export default function ApplyPage() {
  const [form, setForm] = useState<FormState>(initial);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function toggleArray(key: 'subject' | 'gadgets', value: string) {
    setForm(prev => {
      const arr = prev[key];
      const next = arr.includes(value)
        ? arr.filter(v => v !== value)
        : [...arr, value];
      return { ...prev, [key]: next };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Required-field validation (mirrors the original Google Form's required set)
    const required: (keyof FormState)[] = [
      'full_name', 'district', 'place', 'qualification', 'age',
      'offline_exp', 'online_exp', 'syllabus', 'medium',
      'connectivity', 'phone', 'email'
    ];
    for (const f of required) {
      const v = form[f];
      if (typeof v === 'string' && !v.trim()) {
        setError(`Please fill in ${String(f).replace(/_/g, ' ')}.`);
        return;
      }
    }
    if (form.subject.length === 0) {
      setError('Please pick at least one subject.'); return;
    }
    if (form.gadgets.length === 0) {
      setError('Please pick at least one gadget.'); return;
    }
    if (form.syllabus === 'Other' && !form.syllabus_other.trim()) {
      setError('Please specify the syllabus.'); return;
    }
    const ageNum = parseInt(form.age, 10);
    if (Number.isNaN(ageNum) || ageNum < 14 || ageNum > 100) {
      setError('Please enter a valid age (14–100).'); return;
    }

    setSubmitting(true);
    try {
      const supabase = getBrowserClient();

      // 1. Upload photo first (if provided) — public bucket
      let photo_url: string | null = null;
      if (form.photo) {
        const ext = form.photo.name.split('.').pop() || 'jpg';
        const path = `public/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('photos')
          .upload(path, form.photo, { upsert: false });
        if (upErr) throw new Error(`Photo upload failed: ${upErr.message}`);
        const { data: pub } = supabase.storage.from('photos').getPublicUrl(path);
        photo_url = pub.publicUrl;
      }

      // 2. Insert applicant row (anon insert allowed by RLS)
      const { error: insErr } = await supabase.from('applicants').insert({
        full_name: form.full_name.trim(),
        district: form.district.trim(),
        place: form.place.trim(),
        qualification: form.qualification.trim(),
        age: ageNum,
        offline_exp: form.offline_exp.trim(),
        online_exp: form.online_exp.trim(),
        subject: form.subject,
        syllabus: form.syllabus,
        syllabus_other: form.syllabus === 'Other' ? form.syllabus_other.trim() : null,
        medium: form.medium,
        connectivity: form.connectivity,
        phone: form.phone.trim(),
        whatsapp: form.whatsapp.trim() || null,
        email: form.email.trim(),
        gadgets: form.gadgets,
        photo_url
      });

      if (insErr) throw new Error(insErr.message);
      setDone(true);
    } catch (err: any) {
      setError(err.message || 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="container">
        <div className="card">
          <h1>Thank you!</h1>
          <p style={{ marginTop: 12 }}>
            Your application has been submitted. Our team will review it and contact you shortly.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <h1>ALEHA TEACHER — Teacher Registration</h1>
      <p className="subtitle">Fields marked <span style={{ color: '#dc2626' }}>*</span> are required.</p>

      <form onSubmit={handleSubmit} className="card">
        {error && <div className="alert alert-error">{error}</div>}

        <div className="field">
          <label>Full Name <span className="req">*</span></label>
          <input type="text" value={form.full_name}
                 onChange={e => update('full_name', e.target.value)} />
        </div>

        <div className="field">
          <label>District <span className="req">*</span></label>
          <input type="text" value={form.district}
                 onChange={e => update('district', e.target.value)} />
        </div>

        <div className="field">
          <label>Place <span className="req">*</span></label>
          <input type="text" value={form.place}
                 onChange={e => update('place', e.target.value)} />
        </div>

        <div className="field">
          <label>Qualification <span className="req">*</span></label>
          <input type="text" value={form.qualification}
                 onChange={e => update('qualification', e.target.value)} />
        </div>

        <div className="field">
          <label>Age <span className="req">*</span></label>
          <input type="number" min={14} max={100} value={form.age}
                 onChange={e => update('age', e.target.value)} />
        </div>

        <div className="field">
          <label>Experience (offline) <span className="req">*</span></label>
          <textarea value={form.offline_exp}
                    onChange={e => update('offline_exp', e.target.value)} />
        </div>

        <div className="field">
          <label>Online experience? <span className="req">*</span></label>
          <textarea value={form.online_exp}
                    onChange={e => update('online_exp', e.target.value)} />
        </div>

        <div className="field">
          <label>Subject <span className="req">*</span></label>
          <div className="checkbox-group">
            {SUBJECTS.map(s => (
              <label key={s} className={form.subject.includes(s) ? 'checked' : ''}>
                <input type="checkbox" checked={form.subject.includes(s)}
                       onChange={() => toggleArray('subject', s)} />
                {s}
              </label>
            ))}
          </div>
        </div>

        <div className="field">
          <label>Which syllabus are you interested to take classes? <span className="req">*</span></label>
          <select value={form.syllabus} onChange={e => update('syllabus', e.target.value)}>
            <option value="">— Select —</option>
            {SYLLABUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          {form.syllabus === 'Other' && (
            <input type="text" placeholder="Please specify"
                   value={form.syllabus_other}
                   onChange={e => update('syllabus_other', e.target.value)}
                   style={{ marginTop: 8 }} />
          )}
        </div>

        <div className="field">
          <label>Medium of communication <span className="req">*</span></label>
          <select value={form.medium} onChange={e => update('medium', e.target.value)}>
            <option value="">— Select —</option>
            {MEDIUM_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        <div className="field">
          <label>Internet Connectivity <span className="req">*</span></label>
          <div className="checkbox-group">
            {CONNECTIVITY_OPTIONS.map(c => (
              <label key={c} className={form.connectivity === c ? 'checked' : ''}>
                <input type="radio" name="connectivity" checked={form.connectivity === c}
                       onChange={() => update('connectivity', c)} />
                {c}
              </label>
            ))}
          </div>
        </div>

        <div className="field">
          <label>Phone number <span className="req">*</span></label>
          <input type="tel" value={form.phone}
                 onChange={e => update('phone', e.target.value)} />
        </div>

        <div className="field">
          <label>WhatsApp Number</label>
          <input type="tel" value={form.whatsapp}
                 onChange={e => update('whatsapp', e.target.value)} />
          <div className="hint">Optional</div>
        </div>

        <div className="field">
          <label>Email <span className="req">*</span></label>
          <input type="email" value={form.email}
                 onChange={e => update('email', e.target.value)} />
        </div>

        <div className="field">
          <label>Gadgets Available <span className="req">*</span></label>
          <div className="checkbox-group">
            {GADGET_OPTIONS.map(g => (
              <label key={g} className={form.gadgets.includes(g) ? 'checked' : ''}>
                <input type="checkbox" checked={form.gadgets.includes(g)}
                       onChange={() => toggleArray('gadgets', g)} />
                {g}
              </label>
            ))}
          </div>
        </div>

        <div className="field">
          <label>Photo (optional, max 1MB)</label>
          <input type="file" accept="image/*"
                 onChange={e => update('photo', e.target.files?.[0] || null)} />
        </div>

        <button type="submit" className="btn btn-primary" disabled={submitting}
                style={{ marginTop: 16, minWidth: 160 }}>
          {submitting ? 'Submitting…' : 'Submit'}
        </button>
      </form>
    </div>
  );
}