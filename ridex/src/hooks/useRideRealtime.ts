// src/hooks/useRideRealtime.ts
import { useEffect } from 'react';
import { Channel } from 'appwrite';
import { client, DB_ID, TABLE } from '../lib/appwrite';
import { useRide } from '../contexts/RideContext';
import type { RideStatus, DriverInfo } from '../contexts/RideContext';

export function useRideRealtime(rideId: string | null) {
  const { mergeRide } = useRide();

  useEffect(() => {
    if (!rideId) return;

    const channel = Channel.tablesdb(DB_ID).table(TABLE.RIDES).row(rideId).update().toString();
    const unsub = client.subscribe(channel, (response) => {
      const payload = response.payload as Record<string, unknown>;
      const status = payload['status'] as RideStatus | undefined;
      const driverLat = payload['driver_lat'] as number | undefined;
      const driverLng = payload['driver_lng'] as number | undefined;
      const eta = payload['driver_eta'] as number | undefined;
      const driverName = payload['driver_name'] as string | undefined;
      const driverPhone = payload['driver_phone'] as string | undefined;
      const driverVehicle = payload['driver_vehicle_name'] as string | undefined;
      const driverPlate = payload['driver_plate_number'] as string | undefined;
      const driverRating = payload['driver_rating'] as number | undefined;
      const driverPhotoUrl = payload['driver_photo_url'] as string | undefined;
      const otp = payload['otp'] as string | undefined;
      const finalFare = payload['final_fare'] as number | undefined;
      const driverId = payload['driver_id'] as string | undefined;

      const driver: Partial<DriverInfo> = {};
      if (driverId !== undefined) driver.id = driverId;
      if (driverName !== undefined) driver.name = driverName;
      if (driverPhone !== undefined) driver.phone = driverPhone;
      if (driverVehicle !== undefined) driver.vehicle = driverVehicle;
      if (driverPlate !== undefined) driver.plate = driverPlate;
      if (driverRating !== undefined) driver.rating = driverRating;
      if (driverPhotoUrl !== undefined) driver.photoUrl = driverPhotoUrl;
      if (driverLat !== undefined) driver.lat = driverLat;
      if (driverLng !== undefined) driver.lng = driverLng;
      if (eta !== undefined) driver.eta = eta;

      mergeRide({
        ...(status ? { status } : {}),
        ...(otp !== undefined ? { otp } : {}),
        ...(finalFare !== undefined ? { fare: finalFare } : {}),
        ...(Object.keys(driver).length ? { driver: driver as DriverInfo } : {}),
      });
    });

    return () => unsub();
  }, [mergeRide, rideId]);
}
