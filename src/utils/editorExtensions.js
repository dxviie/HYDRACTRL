import { Compartment } from "@codemirror/state";

/** Manage plugin extensions without replacing the editor's base configuration. */
export function createEditorExtensions(dispatch) {
  const compartment = new Compartment();
  const registrations = new Map();

  function configure() {
    dispatch({ effects: compartment.reconfigure([...registrations.values()]) });
  }

  return {
    extension: compartment.of([]),
    addExtension(extension) {
      const registration = Symbol();
      registrations.set(registration, extension);
      try {
        configure();
      } catch (error) {
        registrations.delete(registration);
        throw error;
      }
      return () => {
        if (!registrations.has(registration)) return;
        registrations.delete(registration);
        configure();
      };
    },
  };
}
