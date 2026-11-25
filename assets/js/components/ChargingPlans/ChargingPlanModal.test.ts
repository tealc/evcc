import { mount, config } from "@vue/test-utils";
import { describe, expect, test, vi } from "vite-plus/test";
import ChargingPlanModal from "./ChargingPlanModal.vue";
import type { Vehicle } from "@/types/evcc";

const post = vi.fn();
vi.mock("@/api", () => ({ default: { post: (...args: unknown[]) => post(...args) } }));

config.global.mocks["$i18n"] = { locale: "de-DE" };
config.global.mocks["$t"] = (a: any) => a;

const vehicle = (name: string, title: string): Vehicle => ({
  name,
  title,
  repeatingPlans: [],
  planStrategy: { continuous: false, precondition: 0 },
  absences: [],
});

const mountModal = (vehicleName: string, vehicles: Vehicle[]) => {
  const wrapper = mount(ChargingPlanModal, {
    props: { loadpoints: [{ id: 7, vehicleName } as any], vehicles },
    global: { stubs: { teleport: true, GenericModal: true } },
  });
  (wrapper.vm as any).id = 7;
  return wrapper;
};

describe("absences without connected vehicle", () => {
  test("connected vehicle: no selector, saves to it", () => {
    const wrapper = mountModal("a", [vehicle("a", "Auto A"), vehicle("b", "Auto B")]);
    const vm = wrapper.vm as any;
    expect(vm.absenceVehicleOptions).toEqual([]);
    vm.updateAbsences([]);
    expect(post).toHaveBeenLastCalledWith("vehicles/a/absences", []);
  });

  test("single vehicle is preselected when unplugged", () => {
    const wrapper = mountModal("", [vehicle("a", "Auto A")]);
    const vm = wrapper.vm as any;
    vm.modalVisible();
    expect(vm.absenceVehicle?.name).toBe("a");
    vm.updateAbsences([]);
    expect(post).toHaveBeenLastCalledWith("vehicles/a/absences", []);
  });

  test("selected vehicle is used and remembered", () => {
    const vehicles = [vehicle("a", "Auto A"), vehicle("b", "Auto B")];
    const vm = mountModal("", vehicles).vm as any;
    vm.modalVisible();
    expect(vm.absenceVehicleOptions).toEqual([
      { name: "a", title: "Auto A" },
      { name: "b", title: "Auto B" },
    ]);
    expect(vm.absenceVehicle).toBeUndefined();
    vm.selectAbsenceVehicle("b");
    vm.updateAbsences([]);
    expect(post).toHaveBeenLastCalledWith("vehicles/b/absences", []);

    const again = mountModal("", vehicles).vm as any;
    again.modalVisible();
    expect(again.absenceVehicle?.name).toBe("b");
  });
});
