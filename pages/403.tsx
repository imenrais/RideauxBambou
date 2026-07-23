import { GetServerSideProps } from "next";
import Head from "next/head";
import Link from "next/link";
import StandardLayout from "../components/layout/StandardLayout";
import BackButton from "../components/BackButton";

interface ForbiddenPageProps {
  title: string;
}

export default function ForbiddenPage({ title }: ForbiddenPageProps) {
  return (
    <StandardLayout title={title} description="Access forbidden">
      <div className="-mx-4 -my-8 min-h-screen bg-gray-100 px-4 py-8 dark:bg-gray-900">
        {/* Main Content */}
        <main className="flex min-h-screen items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
          <div className="w-full max-w-md space-y-8 text-center">
            <div className="mb-6">
              <BackButton href="/" />
            </div>
            <div>
              <div className="mx-auto h-24 w-24 text-red-500">
                <svg
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
              </div>
              <h2 className="mt-6 text-3xl font-extrabold text-gray-900 dark:text-white">
                Access Forbidden
              </h2>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                You don't have permission to access this resource.
              </p>
            </div>

            <div className="space-y-4">
              <div className="rounded-md border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                      Admin Access Required
                    </h3>
                    <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                      <p>
                        This page is restricted to administrators only. Please contact an
                        administrator if you believe this is an error.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-center space-x-4">
                <Link
                  href="/"
                  className="rounded-md bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
                >
                  Go Home
                </Link>
                <Link
                  href="/connexion"
                  className="rounded-md bg-gray-600 px-4 py-2 text-white transition-colors hover:bg-gray-700"
                >
                  Sign In
                </Link>
              </div>
            </div>
          </div>
        </main>
      </div>
    </StandardLayout>
  );
}

export const getServerSideProps: GetServerSideProps = async () => {
  return {
    props: {
      title: "403 - Access Forbidden",
    },
  };
};
