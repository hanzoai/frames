/**
 * Dynamically load the producer module. tsup inlines @hanzo/frame-producer
 * via noExternal so this resolves in the published bundle.
 */
export async function loadProducer() {
  return await import("@hanzo/frame-producer");
}
