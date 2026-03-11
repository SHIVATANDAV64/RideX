// src/contexts/RideContext.tsx
import { createContext, useContext, useState, type ReactNode } from 'react';
import type { VehicleType } from '../lib/fare';

export type PaymentMethod = 'cash' | 'stripe_test';
export type PaymentStatus = 'pending' | 'checkout_pending' | 'paid' | 'failed' | 'refunded';

export type RideStatus =
  | 'idle'
  | 'searching'
  | 'driver_assigned'
  | 'driver_arriving'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export interface Location {
  lat: number;
  lng: number;
  address: string;
}

export interface DriverInfo {
  id: string;
  name: string;
  phone: string;
  vehicle: string;
  plate: string;
  rating: number;
  photoUrl?: string;
  eta: number; // minutes
  lat: number;
  lng: number;
}

export interface ActiveRide {
  rideId: string;
  status: RideStatus;
  pickup: Location;
  dropoff: Location;
  vehicleType: VehicleType;
  fare: number;
  paymentMethod?: PaymentMethod;
  paymentStatus?: PaymentStatus;
  driver?: DriverInfo;
  otp?: string;
}

interface RideContextType {
  ride: ActiveRide | null;
  pickup: Location | null;
  dropoff: Location | null;
  selectedVehicle: VehicleType;
  setPickup: (loc: Location | null) => void;
  setDropoff: (loc: Location | null) => void;
  setSelectedVehicle: (v: VehicleType) => void;
  startRide: (r: ActiveRide) => void;
  updateRideStatus: (status: RideStatus, driver?: DriverInfo) => void;
  mergeRide: (patch: Partial<ActiveRide>) => void;
  clearRide: () => void;
}

const RideContext = createContext<RideContextType | null>(null);

export function RideProvider({ children }: { children: ReactNode }) {
  const [ride, setRide] = useState<ActiveRide | null>(null);
  const [pickup, setPickup] = useState<Location | null>(null);
  const [dropoff, setDropoff] = useState<Location | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleType>('mini');

  function startRide(r: ActiveRide) {
    setRide(r);
  }

  function updateRideStatus(status: RideStatus, driver?: DriverInfo) {
    setRide(prev => prev ? { ...prev, status, ...(driver ? { driver } : {}) } : prev);
  }

  function mergeRide(patch: Partial<ActiveRide>) {
    setRide(prev => prev ? {
      ...prev,
      ...patch,
      ...(patch.driver ? { driver: { ...prev.driver, ...patch.driver } as DriverInfo } : {}),
    } : prev);
  }

  function clearRide() {
    setRide(null);
    setPickup(null);
    setDropoff(null);
  }

  return (
    <RideContext.Provider value={{
      ride, pickup, dropoff, selectedVehicle,
      setPickup, setDropoff, setSelectedVehicle,
      startRide, updateRideStatus, mergeRide, clearRide,
    }}>
      {children}
    </RideContext.Provider>
  );
}

export function useRide() {
  const ctx = useContext(RideContext);
  if (!ctx) throw new Error('useRide must be used within RideProvider');
  return ctx;
}
