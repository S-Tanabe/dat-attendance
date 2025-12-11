export interface NotificationTemplate {
  name: string;
  subject: string;
  body: string;
  variables: string[];
}

export const notificationTemplates: Record<string, NotificationTemplate> = {};

export function renderTemplate(
  templateId: string,
  variables: Record<string, string>
): { subject: string; body: string } {
  const template = notificationTemplates[templateId];
  if (!template) {
    return { subject: variables.subject ?? "", body: variables.body ?? "" };
  }

  const interpolate = (text: string) =>
    template.variables.reduce((acc, key) => {
      const value = variables[key] ?? "";
      return acc.replaceAll(`{${key}}`, String(value));
    }, text);

  return {
    subject: interpolate(template.subject),
    body: interpolate(template.body),
  };
}
