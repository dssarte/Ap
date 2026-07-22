const stores = Number(process.env.STORES || 200);
const auditsPerStorePerDay = Number(process.env.AUDITS_PER_STORE_PER_DAY || 3);
const photosPerAudit = Number(process.env.PHOTOS_PER_AUDIT || 10);
const averagePhotoKb = Number(process.env.AVERAGE_PHOTO_KB || 200);
const averageRowKb = Number(process.env.AVERAGE_AUDIT_ROW_KB || 25);

const dailyAudits = stores * auditsPerStorePerDay;
const monthlyAudits = dailyAudits * 30;
const annualAudits = dailyAudits * 365;
const monthlyStorageGb = monthlyAudits * photosPerAudit * averagePhotoKb / 1_000_000;
const annualStorageGb = annualAudits * photosPerAudit * averagePhotoKb / 1_000_000;
const annualDatabaseGb = annualAudits * averageRowKb / 1_000_000;

const format = value => new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);

console.log('FCG capacity model');
console.log(`Stores: ${format(stores)}`);
console.log(`Audits/day: ${format(dailyAudits)}`);
console.log(`Audits/month: ${format(monthlyAudits)}`);
console.log(`Audits/year: ${format(annualAudits)}`);
console.log(`New photo storage/month: ${format(monthlyStorageGb)} GB`);
console.log(`New photo storage/year: ${format(annualStorageGb)} GB`);
console.log(`Estimated audit database growth/year: ${format(annualDatabaseGb)} GB`);
console.log('Adjust with STORES, AUDITS_PER_STORE_PER_DAY, PHOTOS_PER_AUDIT, AVERAGE_PHOTO_KB, and AVERAGE_AUDIT_ROW_KB.');

