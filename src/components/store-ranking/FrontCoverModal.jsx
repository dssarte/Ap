// The checklist itself is broken into more, finer-grained sections than its
// own "Front Cover" summary sheet — e.g. Housekeeping is split into 5
// working-area subsections for filling out, but the Front Cover only ever
// showed one combined "F. Housekeeping" row. This maps each template's own
// section titles onto the coarser groups the Front Cover actually displays,
// in the order they should appear. Templates not listed here just show
// their own sections as-is (one-to-one), which is the sane default for any
// other checklist that doesn't have this printed-sheet quirk.
const FRONT_COVER_GROUPS = {
  "Angel's Pizza Express QA Audit Checklist": [
    { label: 'A. Health & Safety', sections: ['Health & Safety'] },
    { label: 'B. SOP Practices / Product Quality', sections: ['SOP Practices', 'Product Quality'] },
    { label: 'C. Product Knowledge', sections: ['Product Knowledge'] },
    { label: 'D. Cash Funds / Sales Report', sections: ['Cash Funds / Sales Report'] },
    { label: 'E. Employee Image / Customer Service', sections: ['Employee Image / Customer Service'] },
    {
      label: 'F. Housekeeping', sections: [
        'Housekeeping - Exterior Area',
        'Housekeeping - Customer / Counter Area',
        'Housekeeping - Working Area',
        'Housekeeping - Restroom',
        'Housekeeping - Cleaning Materials',
      ],
    },
    { label: 'G. Proper Maintenance of Machine/Equipment', sections: ['Proper Maintenance of Machine/Equipment'] },
    { label: 'H. Delivery Rider', sections: ['Delivery Rider'] },
    { label: 'I. Motorcycle', sections: ['Motorcycle'] },
  ],
  "Koobideh Kebabs QA Audit Checklist": [
    { label: 'A. Health & Safety', sections: ['Health & Safety'] },
    { label: 'B. SOP Practices', sections: ['SOP Practices'] },
    { label: 'C. Product Knowledge', sections: ['Product Knowledge'] },
    { label: 'D. Cash Funds / Sales Report', sections: ['Cash Funds / Sales Report'] },
    { label: 'E. Employee Image / Customer Service', sections: ['Employee Image / Customer Service'] },
    {
      label: 'F. Housekeeping', sections: [
        'Housekeeping - Exterior Area',
        'Housekeeping - Customer / Counter Area',
        'Housekeeping - Working Area',
        'Housekeeping - Restroom',
        'Housekeeping - Cleaning Materials',
      ],
    },
    { label: 'G. Proper Maintenance of Machine/Equipment', sections: ['Proper Maintenance of Machine/Equipment'] },
  ],
  "Angel's Pizza QA Audit Checklist": [
    { label: 'A. Product Quality', sections: ['Product Quality'] },
    { label: 'A.2 Pizza Product Quality', sections: ['Pizza Product Quality'] },
    { label: 'A.3 Pasta Product Quality', sections: ['Pasta & Palabok Product Quality'] },
    { label: 'A.4 Chicken Wings Product Quality', sections: ['Chicken Wings Product Quality'] },
    { label: 'A.5 Combo Meals Product Quality', sections: ['Combo Meals Product Quality'] },
    { label: 'A.6 Side Items Product Quality', sections: ['Side Items Product Quality'] },
    { label: 'A.7 Desserts Product Quality', sections: ['Desserts Product Quality'] },
    { label: 'A.8 Sana Ol Bundle Product Quality', sections: ['Sana Ol Bundle Product Quality'] },
    { label: 'B. Product Knowledge', sections: ['Product Knowledge'] },
    { label: 'C. SOP Practices', sections: ['SOP Practices'] },
    { label: 'D. Employee Image / Customer Service', sections: ['Employee Image / Customer Service'] },
    { label: 'E. Cash Funds', sections: ['Cash Funds / Sales Report'] },
    { label: 'F. Housekeeping / Proper Maintenance of Machines', sections: ['Housekeeping / Proper Maintenance of Machine/Equipment'] },
  ],
  "Figaro QA Audit Checklist": [
    { label: 'A. Health & Safety', sections: ['Health & Safety'] },
    { label: 'B. SOP Practices (Bar)', sections: ['SOP Practices (Bar)'] },
    { label: 'C. SOP Practices (Cashier)', sections: ['SOP Practices (Cashier)'] },
    { label: 'D. SOP Practices (Food)', sections: ['SOP Practices (Food)'] },
    { label: 'E. Product Knowledge', sections: ['Product Knowledge'] },
    { label: 'F. Employee Image / Customer Service', sections: ['Employee Image / Customer Service'] },
    { label: 'G. Housekeeping', sections: ['Housekeeping'] },
    { label: 'H. Proper Maintenance of Machine/Equipment', sections: ['Proper Maintenance of Machine/Equipment'] },
  ],
  "Tien Ma's QA Audit Checklist": [
    { label: 'A. Health & Safety', sections: ['Health & Safety'] },
    { label: 'B. SOP Practices', sections: ['SOP Practices'] },
    { label: 'C. Cash Funds & Reports', sections: ['Cash Funds & Reports'] },
    { label: 'D. Employee Image / Customer Service', sections: ['Employee Image / Customer Service'] },
    { label: 'E. Product Knowledge', sections: ['Product Knowledge'] },
    {
      label: 'F. Housekeeping', sections: [
        'Housekeeping - Exterior Area',
        'Housekeeping - Customer / Counter Area',
        'Housekeeping - Working Area',
        'Housekeeping - Restroom',
        'Housekeeping - Cleaning Materials',
      ],
    },
    { label: 'G. Proper Maintenance of Machine/Equipment', sections: ['Proper Maintenance of Machine/Equipment'] },
    { label: 'H. Motorcycle', sections: ['Motorcycle'] },
  ],
};

// Shared by Store Ranking's chip drill-down modal and its Excel export, so
// both compute the exact same section breakdown for a given set of
// submissions.
export function computeFrontCover(relevantSubmissions, templatesById) {
  const sectionTotals = {}; // display label -> {yes, no, na}
  let totalYes = 0, totalNo = 0, totalNa = 0;
  let groupOrder = null;

  relevantSubmissions.forEach(sub => {
    const template = templatesById[sub.template_id];
    if (!template?.sections) return;

    const groups = FRONT_COVER_GROUPS[template.title];
    if (groups && !groupOrder) groupOrder = groups.map(g => g.label);
    // section title -> its Front Cover display label, for this template
    const labelForSection = {};
    if (groups) {
      groups.forEach(g => g.sections.forEach(sectionTitle => { labelForSection[sectionTitle] = g.label; }));
    }

    template.sections.forEach(section => {
      const label = labelForSection[section.title] || section.title;
      if (!sectionTotals[label]) sectionTotals[label] = { yes: 0, no: 0, na: 0 };
      (section.items || []).forEach(item => {
        const answer = sub.answers?.[item.id];
        if (answer === 'YES') { sectionTotals[label].yes += 1; totalYes += 1; }
        else if (answer === 'NO') { sectionTotals[label].no += 1; totalNo += 1; }
        else if (answer === 'NA') { sectionTotals[label].na += 1; totalNa += 1; }
      });
    });
  });

  const orderedTitles = groupOrder
    ? [...groupOrder, ...Object.keys(sectionTotals).filter(t => !groupOrder.includes(t))]
    : Object.keys(sectionTotals);

  return {
    sectionRows: orderedTitles.filter(title => sectionTotals[title]).map(title => ({ title, ...sectionTotals[title] })),
    totals: { yes: totalYes, no: totalNo, na: totalNa },
    auditCount: relevantSubmissions.length,
  };
}
