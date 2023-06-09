import { Link, useSearchParams } from "@remix-run/react";

import { useOptionalUser } from "~/utils";

export const meta = () => [{ title: "Polygon ID JS SDK Demo" }];

export default function Index() {
  const [searchParams] = useSearchParams();
  console.log("searchParams:", searchParams.toString());

  const user = useOptionalUser();

  return (
    <main className="relative min-h-screen bg-white sm:flex sm:items-center sm:justify-center">
      <div className="relative sm:pb-16 sm:pt-8">
        <div className="mx-auto max-w-7xl sm:px-6 lg:px-8">
          <div className="relative shadow-xl sm:overflow-hidden sm:rounded-2xl">
            <div className="relative px-4 pb-8 pt-16 sm:px-6 sm:pb-14 sm:pt-24 lg:px-8 lg:pb-20 lg:pt-32">
              <h1 className="text-center text-6xl text-6xl font-extrabold tracking-tight">
                <span className="block uppercase text-purple-500 drop-shadow-md">Polygon ID</span>
                <span className="block uppercase text-purple-500 drop-shadow-md">JS SDK Demo</span>
              </h1>
              <div className="mx-auto mt-6 max-w-sm sm:flex sm:max-w-none sm:justify-center">
                {user ? (
                  <div className="space-y-4 sm:mx-auto sm:inline-grid sm:grid-cols-1 sm:gap-5 sm:space-y-0">
                    <p className="flex items-center justify-center px-4 py-3 text-base font-medium text-purple-700 sm:px-8">
                      Logged in as {user.email}.
                    </p>
                    <Link
                      to={{ pathname: "/holder", search: searchParams.toString() }}
                      className="flex items-center justify-center rounded-md border bg-white px-4 py-3 text-base font-medium text-purple-700 shadow-sm hover:bg-purple-50 sm:px-8"
                    >
                      View Holder page
                    </Link>
                    <Link
                      to={{ pathname: "/issuer", search: searchParams.toString() }}
                      className="flex items-center justify-center rounded-md border bg-white px-4 py-3 text-base font-medium text-purple-700 shadow-sm hover:bg-purple-50 sm:px-8"
                    >
                      View Issuer page
                    </Link>
                    <Link
                      to={{ pathname: "/verification", search: searchParams.toString() }}
                      className="flex items-center justify-center rounded-md border bg-white px-4 py-3 text-base font-medium text-purple-700 shadow-sm hover:bg-purple-50 sm:px-8"
                    >
                      View Verification page
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4 sm:mx-auto sm:inline-grid sm:grid-cols-2 sm:gap-5 sm:space-y-0">
                    <Link
                      to={{
                        pathname: "/join",
                        search: `?redirectTo=${encodeURIComponent("/?" + searchParams.toString())}`,
                      }}
                      className="flex items-center justify-center rounded-md border bg-white px-4 py-3 text-base font-medium text-purple-700 shadow-sm hover:bg-purple-50 sm:px-8"
                    >
                      Sign up
                    </Link>
                    <Link
                      to={{
                        pathname: "/login",
                        search: `?redirectTo=${encodeURIComponent("/?" + searchParams.toString())}`,
                      }}
                      className="flex items-center justify-center rounded-md bg-purple-500 px-4 py-3 font-medium text-white hover:bg-purple-600"
                    >
                      Log In
                    </Link>
                  </div>
                )}
              </div>
              <a href="https://remix.run">
                <img
                  src="https://user-images.githubusercontent.com/1500684/158298926-e45dafff-3544-4b69-96d6-d3bcc33fc76a.svg"
                  alt="Remix"
                  className="mx-auto mt-16 w-full max-w-[12rem] md:max-w-[16rem]"
                />
              </a>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
