import supabase from '../Config/db.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const resolveInvoiceReferences = async (rows, referenceField) => {
  const invoiceRows = rows.filter(row => {
    const category = String(row.categorie || row.type_archive || row.type || '').toLocaleLowerCase('fr-FR');
    return category.includes('facture') && UUID_PATTERN.test(String(row[referenceField] || ''));
  });
  const invoiceIds = [...new Set(invoiceRows.map(row => String(row[referenceField])))];
  if (!invoiceIds.length) return rows;

  const invoices = [];
  for (let offset = 0; offset < invoiceIds.length; offset += 500) {
    const { data, error } = await supabase
      .from('factures')
      .select('id, numero_facture')
      .in('id', invoiceIds.slice(offset, offset + 500));
    if (error) throw error;
    invoices.push(...(data || []));
  }

  const referencesById = new Map(
    invoices.map(invoice => [String(invoice.id), invoice.numero_facture])
  );

  return rows.map(row => {
    const numeroFacture = referencesById.get(String(row[referenceField] || ''));
    return numeroFacture ? { ...row, [referenceField]: numeroFacture } : row;
  });
};
