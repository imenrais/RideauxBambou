import { GetServerSideProps } from "next";
import { useRouter } from "next/router";
import { useEffect } from "react";
import Loading from "../components/ui/Loading";

interface ProductsProps {
  title: string;
}

export default function Products({ title }: ProductsProps) {
  const router = useRouter();
  useEffect(() => {
    void router.replace("/#boutique");
  }, [router]);

  return <Loading fullScreen text={`Redirection vers ${title}...`} />;
}

export const getServerSideProps: GetServerSideProps = async () => {
  return {
    props: {
      title: "Boutique - Rideaux Bambou",
    },
  };
};
