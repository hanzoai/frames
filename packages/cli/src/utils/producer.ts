/**
 * Dynamically load the producer module. tsup inlines @hanzo/frames-producer
 * via noExternal so this resolves in the published bundle.
 */
export async function loadProducer() {
  return await import("@hanzo/frames-producer");
}
