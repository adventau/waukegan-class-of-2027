// What each public form accepts. The server checks every field here; the browser checks are only a convenience.
// kind: text | email | textarea | select | checkbox | date | url | file | list
export const FORMS = {
  photo: {
    label: 'Photo',
    review: true,
    fields: {
      name: { kind: 'text', required: true, max: 80 },
      email: { kind: 'email', required: true },
      photo: { kind: 'file', required: true },
      event_slug: { kind: 'text', max: 120 },
      event_other: { kind: 'text', max: 120 },
      caption: { kind: 'textarea', max: 500 },
      credit: { kind: 'text', max: 80 },
      allow_download: { kind: 'checkbox' },
      permission: { kind: 'checkbox', required: true },
    },
  },
  spotlight: {
    label: 'Spotlight nomination',
    review: true,
    fields: {
      nominee_name: { kind: 'text', required: true, max: 80 },
      activities: { kind: 'text', max: 200 },
      why: { kind: 'textarea', required: true, max: 3000 },
      photo: { kind: 'file' },
      nominator_name: { kind: 'text', required: true, max: 80 },
      email: { kind: 'email', required: true },
    },
  },
  directory: {
    label: 'Directory sign-up',
    review: true,
    fields: {
      name: { kind: 'text', required: true, max: 80 },
      email: { kind: 'email', required: true },
      photo: { kind: 'file' },
      path_type: { kind: 'select', required: true, options: ['College', 'Trade School', 'Military', 'Career', 'Gap Year', 'Undecided'] },
      future_plans: { kind: 'text', required: true, max: 200 },
      activities: { kind: 'text', max: 200 },
      memory: { kind: 'textarea', max: 1000 },
      quote: { kind: 'text', max: 200 },
      consent: { kind: 'checkbox', required: true },
    },
  },
  announcement: {
    label: 'Announcement request',
    review: true,
    fields: {
      name: { kind: 'text', required: true, max: 80 },
      organization: { kind: 'text', max: 120 },
      email: { kind: 'email', required: true },
      title: { kind: 'text', required: true, max: 160 },
      details: { kind: 'textarea', required: true, max: 4000 },
      requested_date: { kind: 'date' },
      link: { kind: 'url' },
      image: { kind: 'file' },
    },
  },
  contact: {
    label: 'Contact message',
    review: false,
    fields: {
      name: { kind: 'text', required: true, max: 80 },
      email: { kind: 'email', required: true },
      topic: { kind: 'select', options: ['Question', 'Correction', 'Photo removal request', 'Accessibility', 'Other'] },
      message: { kind: 'textarea', required: true, max: 5000 },
    },
  },
  newsletter: {
    label: 'Email sign-up',
    review: false,
    fields: {
      email: { kind: 'email', required: true },
      categories: { kind: 'list', max: 10 },
    },
  },
};

const EMAIL = /^[^\s@<>]{1,64}@[^\s@<>]{1,190}\.[a-z]{2,24}$/i;

// Returns { data, file, errors } from a FormData object.
export function validate(type, form) {
  const def = FORMS[type];
  const data = {};
  const errors = {};
  let file = null;
  for (const [name, f] of Object.entries(def.fields)) {
    if (f.kind === 'file') {
      const v = form.get(name);
      if (v && typeof v === 'object' && v.size > 0) file = { name, blob: v };
      else if (f.required) errors[name] = 'Please choose a photo.';
      continue;
    }
    if (f.kind === 'checkbox') {
      const on = form.get(name) != null && form.get(name) !== 'false';
      if (f.required && !on) errors[name] = 'This box is required.';
      data[name] = on;
      continue;
    }
    if (f.kind === 'list') {
      data[name] = form.getAll(name).map((x) => String(x).slice(0, 40)).slice(0, f.max);
      continue;
    }
    const v = String(form.get(name) ?? '').trim();
    if (!v) {
      if (f.required) errors[name] = 'This field is required.';
      data[name] = '';
      continue;
    }
    if (f.max && v.length > f.max) errors[name] = `Please keep this under ${f.max} characters.`;
    if (f.kind === 'email' && !EMAIL.test(v)) errors[name] = 'Please enter a valid email address.';
    if (f.kind === 'url' && !/^https?:\/\/\S+$/i.test(v)) errors[name] = 'Links must start with http:// or https://';
    if (f.kind === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(v)) errors[name] = 'Please pick a date.';
    if (f.kind === 'select' && f.options && !f.options.includes(v)) errors[name] = 'Please pick one of the options.';
    data[name] = v;
  }
  if (type === 'photo' && data.event_slug === 'other' && !data.event_other) errors.event_other = 'Type the name of the event.';
  if (type === 'photo' && data.event_slug !== 'other') data.event_other = '';
  return { data, file, errors };
}
