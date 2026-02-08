import React, { useMemo } from 'react';
import { format, parseISO, getDay } from 'date-fns';
import { hu } from 'date-fns/locale';
import clsx from 'clsx';
import { Menu, Transition } from '@headlessui/react';

interface DateTabsProps {
    dates: string[];
    selectedDate: string | null;
    onSelectDate: (date: string) => void;
    cinemas: string[];
    selectedCinema: string | null;
    onSelectCinema: (cinema: string | null) => void;
}

export default function DateTabs({
    dates = [],
    selectedDate,
    onSelectDate,
    cinemas = [],
    selectedCinema,
    onSelectCinema
}: DateTabsProps) {
    // Logic:
    // Render a fixed filter button on the left, separated by a vertical divider.
    // To the right of the divider, render the scrollable list of dates.

    const DateButton = ({ date }: { date: string }) => {
        const isSelected = selectedDate === date;
        const dateObj = parseISO(date);
        const dayName = format(dateObj, 'EEE', { locale: hu }); // Short name
        const dayNum = format(dateObj, 'MMM d.', { locale: hu });

        return (
            <button
                onClick={() => onSelectDate(date)}
                className={clsx(
                    "flex flex-col items-center justify-center px-2 md:px-4 py-1 h-12 rounded-lg text-sm transition-all duration-200 border min-w-[70px]",
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
        <div className="flex items-center gap-2 -mx-4 px-4 md:mx-0 md:px-1 py-2">
            {/* Filter Button (Fixed) */}
            <Menu as="div" className="relative shrink-0 mr-1">
                <Menu.Button
                    className={clsx(
                        "flex items-center justify-center w-12 h-12 rounded-lg transition-colors border",
                        selectedCinema
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted hover:text-foreground"
                    )}
                    title="Mozi szűrése"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                    </svg>
                </Menu.Button>
                <Transition
                    as={React.Fragment}
                    enter="transition ease-out duration-100"
                    enterFrom="transform opacity-0 scale-95"
                    enterTo="transform opacity-100 scale-100"
                    leave="transition ease-in duration-75"
                    leaveFrom="transform opacity-100 scale-100"
                    leaveTo="transform opacity-0 scale-95"
                >
                    <Menu.Items className="absolute left-0 top-full mt-2 w-56 origin-top-left rounded-md bg-popover text-popover-foreground shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50 max-h-80 overflow-y-auto">
                        <div className="p-1">
                            <Menu.Item>
                                {({ active }) => (
                                    <button
                                        onClick={() => onSelectCinema(null)}
                                        className={clsx(
                                            "flex w-full items-center rounded-md px-2 py-2 text-sm",
                                            active ? "bg-accent text-accent-foreground" : "text-popover-foreground",
                                            !selectedCinema && "font-bold bg-accent/50"
                                        )}
                                    >
                                        Összes mozi
                                    </button>
                                )}
                            </Menu.Item>
                            {cinemas.map((cinema) => (
                                <Menu.Item key={cinema}>
                                    {({ active }) => (
                                        <button
                                            onClick={() => onSelectCinema(cinema)}
                                            className={clsx(
                                                "flex w-full items-center rounded-md px-2 py-2 text-sm",
                                                active ? "bg-accent text-accent-foreground" : "text-popover-foreground",
                                                selectedCinema === cinema && "font-bold bg-accent/50"
                                            )}
                                        >
                                            {cinema}
                                        </button>
                                    )}
                                </Menu.Item>
                            ))}
                        </div>
                    </Menu.Items>
                </Transition>
            </Menu>

            {/* Vertical Divider */}
            <div className="h-8 w-px bg-border flex-shrink-0" />

            {/* Scrollable Date Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide flex-grow mask-fade-right p-1">
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
                                <div className="h-8 w-px bg-border flex-shrink-0" />
                            )}
                        </React.Fragment>
                    );
                })}
            </div>
        </div>
    );
}
