import type { GetServerSideProps } from "next";

/** Old worker login path — return 404 so it cannot be guessed. Use /acces-employe. */
export const getServerSideProps: GetServerSideProps = async () => {
  return { notFound: true };
};

export default function WorkerLoginRemoved() {
  return null;
}
