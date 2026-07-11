import { ReactNode } from "react";

interface TableProps {
  children: ReactNode;
  className?: string;
}

interface TableHeaderProps {
  children: ReactNode;
  className?: string;
}

interface TableBodyProps {
  children: ReactNode;
  className?: string;
}

interface TableRowProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}

interface TableCellProps {
  children: ReactNode;
  className?: string;
  align?: "left" | "center" | "right";
}

interface TableHeadProps {
  children: ReactNode;
  className?: string;
  align?: "left" | "center" | "right";
}

export const adminTableComfortableSpacingClassName =
  "[&_th]:!px-5 [&_td]:!px-5 sm:[&_th]:!px-6 sm:[&_td]:!px-6";

export const adminTableRoomySpacingClassName =
  "[&_th]:!px-6 [&_td]:!px-6 [&_th]:!py-4 [&_td]:!py-5 sm:[&_th]:!px-8 sm:[&_td]:!px-8";

export const adminTableShellClassName =
  "mx-auto w-full max-w-full overflow-hidden rounded-lg bg-white shadow-lg dark:bg-gray-800 md:w-fit";

export const adminTableShellInsetClassName =
  "mx-auto w-full max-w-full overflow-hidden rounded-lg bg-white dark:bg-gray-800 md:w-fit";

export const adminTableClassName =
  "w-max max-w-full table-auto divide-y divide-gray-200 [&_td]:px-3 [&_th]:px-3 [&_th]:font-semibold [&_th]:tracking-wide sm:[&_td]:px-4 sm:[&_th]:px-4 dark:divide-gray-700";

export const adminTableHeaderClassName = "bg-gray-50 dark:bg-gray-700";

export const adminTableHeadTextClassName =
  "text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300";

export const adminTableHeadCellClassName = `whitespace-nowrap px-3 py-3 text-center sm:px-4 ${adminTableHeadTextClassName}`;

export const adminTableBodyClassName =
  "divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800";

export const adminTableCellClassName =
  "whitespace-nowrap px-3 py-4 text-center text-sm text-gray-900 dark:text-white sm:px-4";

export function Table({ children, className = "" }: TableProps) {
  return (
    <div className="flex justify-center overflow-x-auto">
      <table className={`${adminTableClassName} ${className}`.trim()}>{children}</table>
    </div>
  );
}

export function TableHeader({ children, className = "" }: TableHeaderProps) {
  return <thead className={`${adminTableHeaderClassName} ${className}`.trim()}>{children}</thead>;
}

export function TableBody({ children, className = "" }: TableBodyProps) {
  return <tbody className={`${adminTableBodyClassName} ${className}`.trim()}>{children}</tbody>;
}

export function TableRow({ children, className = "", hover = false }: TableRowProps) {
  const hoverClass = hover ? "hover:bg-gray-50 dark:hover:bg-gray-700/50" : "";
  return <tr className={`${hoverClass} ${className}`.trim()}>{children}</tr>;
}

export function TableHead({ children, className = "", align = "center" }: TableHeadProps) {
  const alignClasses = {
    left: "text-left",
    center: "text-center",
    right: "text-right",
  };

  return (
    <th className={`${adminTableHeadCellClassName} ${alignClasses[align]} ${className}`.trim()}>
      {children}
    </th>
  );
}

export function TableCell({ children, className = "", align = "center" }: TableCellProps) {
  const alignClasses = {
    left: "text-left",
    center: "text-center",
    right: "text-right",
  };

  return (
    <td className={`${adminTableCellClassName} ${alignClasses[align]} ${className}`.trim()}>
      {children}
    </td>
  );
}
