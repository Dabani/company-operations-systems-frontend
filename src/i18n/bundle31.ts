// COPS Bundle 31 UI strings (documents on quotes and invoices). rw/sw pending native review.
type D = Record<string, string>;

const en: D = {
  'att.none': 'No documents attached.',
  'att.add': 'Attach document',
  'att.quote_docs': 'Quote documents',
  'att.invoice_docs': 'Invoice documents',
};

const fr: D = {
  'att.none': 'Aucun document joint.',
  'att.add': 'Joindre un document',
  'att.quote_docs': 'Documents de devis',
  'att.invoice_docs': 'Documents de facture',
};

const rw: D = {
  'att.none': 'Nta nyandiko ziheruwe.',
  'att.add': 'Ongeraho inyandiko',
  'att.quote_docs': 'Inyandiko z\'ibiciro',
  'att.invoice_docs': 'Inyandiko za fagitire',
};

const sw: D = {
  'att.none': 'Hakuna hati zilizoambatishwa.',
  'att.add': 'Ambatisha hati',
  'att.quote_docs': 'Hati za nukuu',
  'att.invoice_docs': 'Hati za ankara',
};

export default { en, fr, rw, sw };
