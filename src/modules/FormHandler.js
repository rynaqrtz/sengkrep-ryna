const CsrfHandler = require('./CsrfHandler');

class FormHandler {
  constructor(options = {}) {
    this.csrf = new CsrfHandler(options.csrf ?? {});
  }

  parse($, selector, baseUrl) {
    const form = $(selector || 'form');
    if (form.length === 0) return null;

    const el      = form.get(0);
    const attrs   = el.attribs ?? el.attrs ?? {};
    const action  = attrs.action ? new URL(attrs.action, baseUrl).href : baseUrl;
    const method  = (attrs.method ?? 'GET').toUpperCase();

    const fields = {};
    form.find('input, select, textarea').each((_, fieldEl) => {
      const fa   = fieldEl.attribs ?? fieldEl.attrs ?? {};
      const name = fa.name;
      if (!name) return;

      const tag  = fieldEl.tag;
      const type = (fa.type ?? 'text').toLowerCase();

      if (tag === 'input' && (type === 'checkbox' || type === 'radio')) {
        if (fa.checked !== undefined) fields[name] = fa.value ?? 'on';
        return;
      }

      if (tag === 'select') {
        const selected = $(fieldEl).find('option[selected]');
        fields[name] = selected.length > 0 ? selected.attr('value') : $(fieldEl).find('option').first().attr('value');
        return;
      }

      fields[name] = fa.value ?? $(fieldEl).text() ?? '';
    });

    return { action, method, fields };
  }

  buildSubmission(parsedForm, overrides = {}) {
    const fields = { ...parsedForm.fields, ...overrides };
    const token  = fields._token ?? fields.csrf_token ?? null;

    return {
      url:     parsedForm.action,
      method:  parsedForm.method,
      body:    this.csrf.buildFormBody(fields, token),
      headers: this.csrf.buildHeaders(token, { 'Content-Type': 'application/x-www-form-urlencoded' }),
    };
  }
}

module.exports = FormHandler;
