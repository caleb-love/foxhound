import { runContract } from "./contract.js";
import { InMemoryConsumer, InMemoryProducer, resetInMemoryBus } from "../src/index.js";

runContract({
  name: "in-memory",
  settleMs: 50,
  make: async () => {
    resetInMemoryBus();
    return {
      producer: new InMemoryProducer(),
      consumer: new InMemoryConsumer(),
      teardown: async () => {
        resetInMemoryBus();
      },
    };
  },
});
