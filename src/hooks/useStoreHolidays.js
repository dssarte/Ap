import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

const NO_HOLIDAYS = [];

// Every holiday (Administration › Holidays) — a handful a year, so all of
// them in one go; the pages pick out the days they show. Until the holidays
// migration has run there's no table to read, and completion simply counts
// as before.
export function useStoreHolidays({ enabled = true } = {}) {
  const { data } = useQuery({
    queryKey: ['store-holidays'],
    queryFn: async () => {
      try {
        return await base44.entities.StoreHoliday.list('-date_from', 2000);
      } catch (error) {
        console.warn('Store holidays unavailable:', error?.message || error);
        return NO_HOLIDAYS;
      }
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });
  return data || NO_HOLIDAYS;
}
