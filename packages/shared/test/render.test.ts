import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { renderTemplate } from '../src/email/render.js';

describe('renderTemplate', () => {
  it('substitutes simple variables and HTML-escapes by default', () => {
    const r = renderTemplate(
      {
        subject: 'Hello {{name}}',
        body_md: 'Hi {{name}} <b>{{role}}</b>',
        variables: ['name', 'role'],
      },
      { name: 'Ana', role: 'Counselor & Advisor' },
    );
    assert.equal(r.subject, 'Hello Ana');
    assert.match(r.text, /Counselor &amp; Advisor/);
    assert.deepEqual(r.missing, []);
  });

  it('passes raw values through {{{var}}}', () => {
    const r = renderTemplate(
      { subject: 's', body_md: '{{{html}}}', variables: ['html'] },
      { html: '<a href="x">x</a>' },
    );
    assert.equal(r.text, '<a href="x">x</a>');
  });

  it('reports missing declared variables', () => {
    const r = renderTemplate(
      { subject: 's', body_md: 'hi {{first_name}}', variables: ['first_name', 'school'] },
      { first_name: 'Sam' },
    );
    assert.deepEqual(r.missing, ['school']);
  });

  it('renders empty string for missing lookups (no crash)', () => {
    const r = renderTemplate(
      { subject: 'x {{missing}}', body_md: '{{absent}}', variables: [] },
      {},
    );
    assert.equal(r.subject, 'x ');
    assert.equal(r.text, '');
  });
});
