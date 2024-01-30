import React, { useContext, useState, useEffect } from "react";
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import { Context } from "../../store/appContext";

export default function Calendar() {

  const {store, actions} = useContext(Context)
  // Definisci lo stato per la gestione dei clic sulle date
  const [selectedEvent, setSelectedEvent] = useState({});
  const [showOffcanvas, setShowOffcanvas] = useState(false);
  const [showAddBooking, setShowAddBooking] = useState(false);
  const [detailsLoaded, setDetailsLoaded] = useState(false)
  const [endingDatesLoaded, setEndingDatesLoaded] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await actions.authentication(store.token);

        if (!response) {
          console.error('Error: Respuesta de autenticación no válida');
          return;
        }

        const proId = response.logged_in_as;
        await actions.getPro(proId);
        console.log("-----PRO-----", store.currentPro);

        await actions.getLocationsByPro(proId);
        console.log("-----PRO-LOCATIONS-----", store.currentLocations);

        await actions.getBookingsByPro(proId);
        console.log("-----PRO-BOOKINGS-----", store.bookingsByPro);

        await actions.getServicesByPro(proId);
        console.log("-----SERVICES-BY-PRO-----", store.servicesByPro);

        await actions.getProServicesByPro(proId);
        console.log("-----PRO-SERVICES-----", store.proServicesByPro);

        await actions.getHoursByPro(proId);
        console.log("-----PRO-HOURS-----", store.hoursByPro);

        await actions.getHoursByLocation(store.currentLocations[0].id);
        console.log("-----LOCATION-HOURS-----", store.hoursByLocation);

        await actions.getInactivityByPro(proId);
        console.log("-----PRO-INACTIVITY-----", store.inactivityByPro);

        const bookingPromises = Object.values(store.bookingsByPro).map(async (booking) => {
          const serviceByBookingPromise = actions.getServiceByBooking(booking.pro_service)
          const patientByBookingPromise = actions.getPatient(booking.patient)
          const proServiceByBookingPromise = actions.getProService(booking.pro_service)
          const [serviceByBooking, patientByBooking, proServiceByBooking] = await Promise.all([
            serviceByBookingPromise,
            patientByBookingPromise,
            proServiceByBookingPromise
          ]);
        booking.service = serviceByBooking;
        booking.patient = patientByBooking;
        booking.pro_service = proServiceByBooking;

        return booking;
      });

      let bookingsWithServiceList = await Promise.all(bookingPromises);
      store.fullBookingsByPro = bookingsWithServiceList;
      console.log("-----STORE_FULL_BOOKINGS-----", store.fullBookingsByPro);
      setDetailsLoaded(true)


      } catch (error) {
        console.error('Error al obtener datos del profesional:', error);
      }
    };
    if (store.fullBookingsByPro.length === 0) {
      fetchData(); 
    }
    
  }, [store.isLoggedIn, store.token]);

  // Give calculated ending time to bookings
  useEffect(() => {
    function getEndingDate(booking, date, starting_time, minutes) {
      const fullDate = new Date(`${date}T${starting_time}`);
      fullDate.setMinutes(fullDate.getMinutes() + parseInt(minutes, 10));
      const hours = fullDate.getHours().toString().padStart(2, '0');
      const nerMinutes = fullDate.getMinutes().toString().padStart(2, '0');
      const seconds = fullDate.getSeconds().toString().padStart(2, '0');
      const finalTime = `${hours}:${nerMinutes}:${seconds}`;
      
      booking.ending_time = finalTime;
      return booking;
    }
    if (store.fullBookingsByPro.length > 0) {
      store.fullBookingsByPro = store.fullBookingsByPro.map((booking) => {
        return getEndingDate(
          booking,
          booking.date,
          booking.starting_time,
          booking.pro_service.duration
        );
      });
      setEndingDatesLoaded(true)
    }
    console.log("fullBookingsByPro with ending date:", store.fullBookingsByPro);
  }, [detailsLoaded]);



  // Definisci la funzione per gestire i clic sulle date
  const handleEventClick = (arg) => {
    console.log('arg event: ', arg.event)
    setSelectedEvent(arg.event);
    setShowOffcanvas(!showOffcanvas)
  }

  const handleCloseCanvas = () => {
    setShowOffcanvas(!showOffcanvas)
  }

  const handleAddBookingForm = () => {
    setShowAddBooking(!showAddBooking)
  }

  return (
    <div className="min-vh-100">
      <div id='account-data' className="align-items-center bg-light py-5 container">
        <div className="text-black-50 w-75 mx-auto mb-5">
          <div className="d-flex mb-4">
            <h4 className="text-decoration-underline">MY CALENDAR</h4>
            <button className="btn btn-sm ms-auto text-white" style={{ backgroundColor: "#14C4B9" }} onClick={handleAddBookingForm}>Add New Booking</button>
          </div>
          <div className="p-5 rounded bg-white border text-black-50">
            <FullCalendar
              plugins={[timeGridPlugin]}
              initialView='timeGridWeek'
              headerToolbar={{
                left: 'prev,next,today',
                center: 'title',
                right: 'timeGridWeek,timeGridDay' // user can switch between the two
              }}
              duration={{ days: 4 }}
              weekends={true}
              eventClick={handleEventClick}
              eventColor='#14C4B9'
              allDaySlot={false}
              events={
                endingDatesLoaded
                  ? store.fullBookingsByPro.map((booking) => ({
                      title: booking.service.service_name,
                      start: `${booking.date}T${booking.starting_time}:00`,
                      end: `${booking.date}T${booking.ending_time}`,
                      extendedProps: {
                        specialization: booking.service.specialization,
                        service: booking.service.service_name, 
                        patient: booking.patient.name,
                        status: booking.status,
                        duration: booking.pro_service.duration
                      },
                    }))
                  : []
              }
            />
          </div>
        </div>


        {showOffcanvas ? (
          <div className="bg-white position-fixed top-0 end-0 bottom-0 min-vh-100 py-5 px-4 w-25 shadow" style={{ zIndex: "2" }} >

            <div className="d-flex justify-content-between mb-5">
              <h5 className="me-4 text-black-50 text-decoration-underline fw-bold" >BOOKING DETAILS</h5>
              <button type="button" className="btn-close" onClick={handleCloseCanvas} ></button>
            </div>
            <div className="rounded bg-dark bg-opacity-10 p-3 text-black-50 fw-light">
              <p>EVENT NAME: <strong className="fw-bold">{selectedEvent.title}</strong></p>
              <p>DATE: <strong className="fw-bold">{selectedEvent.startStr}</strong></p>
              <p>DURATION: <strong className="fw-bold">{selectedEvent.extendedProps.duration} minutes</strong></p>
              <p>SPECIALIZATION: <strong className="fw-bold">{selectedEvent.extendedProps.specialization}</strong></p>
              <p>SERVICE: <strong className="fw-bold">{selectedEvent.extendedProps.service}</strong></p>
              <p>PATIENT: <strong className="fw-bold">{selectedEvent.extendedProps.patient}</strong></p>
              <p>STATUS: <strong className="fw-bold">{selectedEvent.extendedProps.status}</strong></p>
              <p>PATIENT NOTES: <strong className="fw-bold"></strong></p>
              <p>MY NOTES: <strong className="fw-bold"></strong></p>
            </div>

          </div>


        ) : (null)}


        {showAddBooking ? (
          <div className="bg-white position-fixed top-0 end-0 bottom-0 min-vh-100 py-5 px-4 w-25 shadow" style={{ zIndex: "2" }} >

            <div className="d-flex justify-content-between mb-5">
              <h5 className="me-4 text-black-50 text-decoration-underline fw-bold" >ADD NEW BOOKING</h5>
              <button type="button" className="btn-close" onClick={handleAddBookingForm} ></button>
            </div>

            <div className="rounded bg-dark bg-opacity-10 p-3 text-black-50 fw-light">
              <form>
                <div>
                  <h5 className="mb-4 text-decoration-underline">Booking Details</h5>
                  <input type='text' placeholder="Date" className="d-block mb-3 p-2 w-100 rounded border-0"></input>
                  <input type='text' placeholder="Starting Time" className="d-block mb-3 p-2 w-100 rounded border-0"></input>
                  <div className="mb-3">
                    <label htmlFor="service" className="form-label">Service</label>
                    <select id="service" className="form-select w-100">
                      <option value="">Select a service</option>
                      <option value="service1">Service 1</option>
                      <option value="service2">Service 2</option>
                      <option value="service3">Service 3</option>
                    </select>
                  </div>
                  <div className="mb-3">
                    <label htmlFor="notes" className="form-label">Notes</label>
                    <textarea id="notes" placeholder="My Notes" className="form-control w-100"></textarea>
                  </div>
                </div>

                <div>
                  <h5 className="mb-4 text-decoration-underline">Patient details</h5>
                  <input type='text' placeholder="Name" className="d-block mb-3 p-2 w-100 rounded border-0"></input>
                  <input type='text' placeholder="Last Name" className="d-block mb-3 p-2 w-100 rounded border-0"></input>
                  <input type='text' placeholder="Email" className="d-block mb-3 p-2 w-100 rounded border-0"></input>
                  <input type='text' placeholder="Phone" className="d-block mb-3 p-2 w-100 rounded border-0"></input>
                </div>

              </form>
            </div>

          </div>


        ) : (null)}


      </div>
    </div>
  )
}