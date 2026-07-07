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

export function Table({ children, className = "" }: TableProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="overflow-x-auto">
        <table className={`w-max min-w-full table-auto divide-y divide-gray-200 dark:divide-gray-700 ${className}`}>
          {children}
        </table>
      </div>
    </div>
  );
}

export function TableHeader({ children, className = "" }: TableHeaderProps) {
  return <thead className={`bg-gray-50 dark:bg-gray-800 ${className}`}>{children}</thead>;
}

export function TableBody({ children, className = "" }: TableBodyProps) {
  return (
    <tbody
      className={`divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800 ${className}`}
    >
      {children}
    </tbody>
  );
}

export function TableRow({ children, className = "", hover = false }: TableRowProps) {
  const hoverClass = hover ? "hover:bg-gray-50 dark:hover:bg-gray-700" : "";
  return <tr className={`${hoverClass} ${className}`}>{children}</tr>;
}

export function TableHead({ children, className = "", align = "center" }: TableHeadProps) {
  const alignClasses = {
    left: "text-left",
    center: "text-center",
    right: "text-right",
  };

  return (
    <th
      className={`whitespace-nowrap px-4 py-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-300 ${alignClasses[align]} ${className}`}
    >
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
    <td
      className={`whitespace-nowrap px-4 py-4 text-sm text-gray-900 dark:text-white ${alignClasses[align]} ${className}`}
    >
      {children}
    </td>
  );
}
