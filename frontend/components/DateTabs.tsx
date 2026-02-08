import React, { useMemo } from 'react';
import { format, parseISO, getDay } from 'date-fns';
import { hu } from 'date-fns/locale';
import clsx from 'clsx';
import { Menu, Transition } from '@headlessui/react';

interface DateTabsProps {
    dates: string[];
    selectedDate: string | null;
    onSelectDate: (date: string) => void;
}

export default function DateTabs({ dates, selectedDate, onSelectDate }: DateTabsProps) {
    // Logic:
    // Simply render all dates in a horizontal scrollable list.
    // No dropdowns, no hiding.

    const DateButton = ({ date }: { date: string }) => {
        const isSelected = selectedDate === date;
        const dateObj = parseISO(date);
        const dayName = format(dateObj, 'EEE', { locale: hu }); // Short name
        const dayNum = format(dateObj, 'MMM d.', { locale: hu });

        return (
            <button
                onClick={() => onSelectDate(date)}
                className={clsx(
                    "flex flex-col items-center justify-center px-2 md:px-4 py-1 h-12 rounded-lg text-sm transition-all duration-200 border",
                    isSelected
                        ? "bg-primary text-primary-foreground shadow-md font-semibold ring-1 ring-primary"
                        : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted hover:text-foreground"
                )}
            >
                <span className="text-xs uppercase opacity-80 mb-0.5">{dayName}</span>
                <span className="leading-none whitespace-nowrap">{dayNum}</span>
            </button>
        );
    };

    return (
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-2 -mx-4 px-4 md:mx-0 md:px-1">
            {dates.map((date, index) => {
                const dateObj = parseISO(date);
                // 3 is Wednesday (0=Sunday, 1=Monday, ...)
                const isWednesday = getDay(dateObj) === 3;
                const isLast = index === dates.length - 1;

                return (
                    <React.Fragment key={date}>
                        <div className="flex-shrink-0">
                            <DateButton date={date} />
                        </div>
                        {isWednesday && !isLast && (
                            <div className="h-8 w-px bg-border flex-shrink-0 opacity-50" />
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );
}
