// COPS Bundle 36: texts of the send-for-approval confirmations. rw/sw are first-pass translations pending native review.
type D = Record<string, string>;

const en: D = {
  'confirm.submit_timesheet': 'Send the timesheet for approval? It can no longer be edited unless it is returned to you.',
  'confirm.submit_report': 'Send the report to management?',
  'confirm.submit_review': 'Submit the review? It can no longer be edited by the reviewer.',
  'confirm.submit_rule': 'Send this rule version for approval?',
};
const fr: D = {
  'confirm.submit_timesheet': 'Envoyer la feuille de temps pour approbation ? Elle ne pourra plus être modifiée sauf si elle vous est retournée.',
  'confirm.submit_report': 'Envoyer le rapport à la direction ?',
  'confirm.submit_review': 'Soumettre l\'évaluation ? L\'évaluateur ne pourra plus la modifier.',
  'confirm.submit_rule': 'Envoyer cette version de règle pour approbation ?',
};
const rw: D = {
  'confirm.submit_timesheet': 'Kohereza urupapuro rw\'amasaha ngo rwemezwe? Ntirushobora guhindurwa keretse rwongeye gusubizwa.',
  'confirm.submit_report': 'Kohereza raporo ku buyobozi?',
  'confirm.submit_review': 'Kohereza isuzuma? Ntirishobora kongera guhindurwa n\'uriyoboye.',
  'confirm.submit_rule': 'Kohereza iyi verisiyo y\'itegeko ngo yemezwe?',
};
const sw: D = {
  'confirm.submit_timesheet': 'Tuma karatasi ya muda kwa idhini? Haiwezi kubadilishwa isipokuwa irudishwe kwako.',
  'confirm.submit_report': 'Tuma ripoti kwa uongozi?',
  'confirm.submit_review': 'Wasilisha tathmini? Mtathmini hataweza kuibadilisha tena.',
  'confirm.submit_rule': 'Tuma toleo hili la kanuni kwa idhini?',
};

export default { en, fr, rw, sw };
