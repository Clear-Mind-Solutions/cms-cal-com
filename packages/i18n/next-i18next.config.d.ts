declare module "@calcom/i18n/next-i18next.config" {
  export const i18n: {
    locales: string[];
    defaultLocale: string;
  };
  const config: {
    i18n: {
      locales: string[];
      defaultLocale: string;
    };
    fallbackLng: Record<string, string[]>;
    reloadOnPrerender: boolean;
    localePath: string;
  };
  export default config;
}
