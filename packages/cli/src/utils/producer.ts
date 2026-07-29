/**
 * Dynamically load the producer module. tsup inlines @frames/producer
 * via noExternal so this resolves in the published bundle.
 */
export async function loadProducer() {
  return await import("@frames/producer");
}
