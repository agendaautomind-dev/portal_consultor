'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Icons } from '@/components/icons';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import type { PeriodOption } from '../api/types';

export function PeriodSelect({ value, options }: { value: string; options: PeriodOption[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  function changePeriod(period: string | null): void {
    if (!period) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set('period', period);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <Select value={value} onValueChange={changePeriod}>
      <SelectTrigger className='w-full sm:w-52' aria-label='Competência'>
        <Icons.calendar className='size-4' />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
