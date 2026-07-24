import type { GetServerSideProps } from "next";

/** /login must not reveal the admin login. Use /connexion only. */
export const getServerSideProps: GetServerSideProps = async () => {
  return { notFound: true };
};

export default function LoginAliasRemoved() {
  return null;
}
