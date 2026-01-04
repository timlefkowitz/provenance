import { use } from 'react';

import { createI18nServerInstance } from './i18n.server';

type PageProps = {
  params: Promise<{
    lang: string;
  }>;
  searchParams: Promise<{
    [key: string]: string | string[] | undefined;
  }>;
};

export function withI18n<T extends PageProps>(
  Component: React.ComponentType<T>,
) {
  return function PageWithI18n(props: T) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    use(createI18nServerInstance());

    return <Component {...props} />;
  };
}

