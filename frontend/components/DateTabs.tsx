import React, { useMemo } from 'react';
import { format, parseISO } from 'date-fns';
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
    // Responsive visibility using CSS classes logic:
    // Mobile (<640px): Show 2 tabs (index 0-1)
    // SM (>=640px): Show 4 tabs (index 0-3)
    // MD (>=768px): Show 5 tabs (index 0-4)
    // LG (>=1024px): Show 7 tabs (index 0-6)

    // Dropdown contains all dates starting from index 2, but hides the ones visible as tabs.

    const DateButton = ({ date, isDropdownItem = false }: { date: string, isDropdownItem?: boolean }) => {
        const isSelected = selectedDate === date;
        const dateObj = parseISO(date);
        const dayName = format(dateObj, 'EEE', { locale: hu }); // Short name
        const dayNum = format(dateObj, 'MMM d.', { locale: hu });

        if (isDropdownItem) {
            return (
                <button
                    onClick={() => onSelectDate(date)}
                    className={clsx(
                        "group flex w-full items-center justify-between rounded-md px-2 py-2 text-sm",
                        isSelected ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"
                    )}
                >
                    <span className="uppercase font-medium">{dayName}</span>
                    <span>{dayNum}</span>
                </button>
            );
        }

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
                <span className="leading-none">{dayNum}</span>
            </button>
        );
    };

    const dropdownDates = dates.slice(2);

    return (
        <div className="flex items-center space-x-1 md:space-x-2">
            {/* Tabs: Render up to 7 tabs, responding to screen size */}
            {dates.slice(0, 7).map((date, index) => (
                <div
                    key={date}
                    className={clsx(
                        index < 2 ? "flex" :
                            index < 4 ? "hidden sm:flex" :
                                index < 5 ? "hidden md:flex" :
                                    "hidden lg:flex"
                    )}
                >
                    <DateButton date={date} />
                </div>
            ))}

            {/* "Később" Dropdown: Visible if there are more dates than currently shown as tabs */}
            <div className={clsx(
                "relative",
                dates.length <= 2 && "hidden",
                dates.length <= 4 && "sm:hidden",
                dates.length <= 5 && "md:hidden",
                dates.length <= 7 && "lg:hidden"
            )}>
                <Menu as="div" className="relative inline-block text-left">
                    <Menu.Button className="flex flex-col items-center justify-center px-2 md:px-4 py-1 h-12 rounded-lg text-sm transition-all duration-200 border bg-muted/50 text-muted-foreground border-transparent hover:bg-muted hover:text-foreground">
                        <div className="flex items-center">
                            <span className="font-medium mr-1 leading-none">Később</span>
                            <span className="text-[10px] leading-none">▼</span>
                        </div>
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
                        <Menu.Items className="absolute right-0 mt-2 w-40 origin-top-right divide-y divide-border rounded-md bg-popover shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50 max-h-80 overflow-y-auto scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
                            <div className="px-1 py-1">
                                {dropdownDates.map((date, i) => {
                                    const realIndex = i + 2; // slice(2) offset
                                    return (
                                        <Menu.Item
                                            key={date}
                                            as="div"
                                            className={clsx(
                                                realIndex < 4 && "sm:hidden",
                                                realIndex < 5 && "md:hidden",
                                                realIndex < 7 && "lg:hidden"
                                            )}
                                        >
                                            {({ active }) => (
                                                <DateButton date={date} isDropdownItem />
                                            )}
                                        </Menu.Item>
                                    );
                                })}
                            </div>
                        </Menu.Items>
                    </Transition>
                </Menu>
            </div>
        </div>
    );
}
