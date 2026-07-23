export const formFieldLabelClass =
  "mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300";

export const formFieldClass =
  "w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 scheme-light focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder:text-gray-500 dark:scheme-dark";

export const formSelectClass = formFieldClass;

export const formSelectDisabledClass = `${formSelectClass} disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:disabled:bg-gray-800 dark:disabled:text-gray-400`;

export const formFieldDisabledClass =
  "w-full rounded-md border border-gray-300 bg-gray-100 px-3 py-2 text-sm text-gray-700 dark:border-gray-600 dark:bg-gray-700 dark:text-white";

export const formNumberFieldClass = `${formFieldClass} [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]`;

export const formTextareaClass = formFieldClass;

export const formFieldErrorClass =
  "border-red-500 focus:border-red-500 focus:ring-red-500/20 dark:border-red-400";
