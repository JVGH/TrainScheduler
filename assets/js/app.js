$(document).ready(function () {
    // Reference Firebase DB
    let database = firebase.database();

    // Reference Modal
    let modal = $("#modalMsg");
    let modalErrorMsg = $("#errorMsg");

    // Reference Firebase Key
    let oId;
    let id;

    // Google Auth
    let isLoggedIn = false;
    let provider = new firebase.auth.GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/contacts.readonly');
    firebase.auth().useDeviceLanguage();

    // Login
    $(document).on("click", ".google", function () {
        firebase.auth().signInWithPopup(provider).then(function (result) {
            let token = result.credential.accessToken;
            let user = result.user;
            isLoggedIn = true;
            $("#userInput").show();
            $("#userAuth").hide();
        }).catch(function (error) {
            let errorCode = error.code;
            let errorMessage = error.message;
            let email = error.email;
            let credential = error.credential;
            console.log(errorCode, errorMessage);
        });
    })

    // Logout
    $(document).on("click", "#logout", function () {
        firebase.auth().signOut().then(function () {
            isLoggedIn = false;
            $("#userInput").hide();
            $("#userAuth").show();
        }).catch(function (error) {
            let errorCode = error.code;
            let errorMessage = error.message;
            let email = error.email;
            let credential = error.credential;
            console.log(errorCode, errorMessage)
        });
    })

    // Submit event
    $("#btnSubmit").on("click", function (event) {
        event.preventDefault();

        // Reference user input fields into an obj
        oId = $("#inputId").val().trim();
        let inputData = {
            name: $("#inputName").val().trim(),
            destination: $("#inputDestination").val().trim(),
            //isfirstTrainTimeValid: moment($("#inputFirstTrainTime").val(), "HH:mm", true).isValid(),
            firstTrainTime: moment($("#inputFirstTrainTime").val(), "HH:mm").unix(),
            arrivalFrequency: parseInt($("#inputArrivalFrequency").val().trim()),
            dateAdded: firebase.database.ServerValue.TIMESTAMP,
            pollBit: false
        }

        // Error or Push data into Firebase DB
        if (!inputData.name || !inputData.destination || !inputData.firstTrainTime || !inputData.arrivalFrequency) {
            modalErrorMsg.text("Please input valid data");
            modal.modal("show");
        } else {
            pushData(oId, inputData);
        }
    });

    // FX to push data
    function pushData(oId, inputData) {
        // Update (insert/update)
        if (oId) {
            id = oId;
        } else {
            id = database.ref().child("data/trainSchedule/").push().key;
        }
        let updates = {};
        updates["/data/trainSchedule/" + id] = inputData;
        database.ref().update(updates, validatePush);

        // Validate
        function validatePush(error) {
            if (error) {
                modalErrorMsg.text(error);
                modal.modal("show");
            } else {
                $("#inputForm").trigger("reset");
            }
        }
    }

    // Poll Firebase DB every 30 seconds to trigger frontend update
    function pollData() {
        database.ref().child("data/trainSchedule/").once("value", function (snapshot) {
            snapshot.forEach(function (childSnapshot) {
                let childData = childSnapshot.val();
                let currentPollBit = childData.pollBit;
                database.ref().child("data/trainSchedule/" + childSnapshot.key).update({
                    pollBit: !currentPollBit
                })
            })
        });
    };

    setInterval(pollData, 30000);
    /*     setInterval(function() {
            if ( new Date().getSeconds() === 0 ) pollData();
        },1000); */

    // Eventhandler for insert
    database.ref().child("data/trainSchedule/").orderByChild("dateAdded").on("value", function (snapshot) {
        $("tBody").empty();

        snapshot.forEach(function (childSnapshot) {
            let childKey = childSnapshot.key;
            let childData = childSnapshot.val();

            let name = childData.name;
            let destination = childData.destination;
            let firstTrainTime = childData.firstTrainTime;
            let arrivalFrequency = childData.arrivalFrequency;

            let nextArrival = calculateNextArrival(firstTrainTime, arrivalFrequency);
            let minutesUntilNextArrival = nextArrival[0];
            let nextTrainTime = nextArrival[1];

            $("tBody").append(
                "<tr id=\"" + childKey + "\">" +
                "<th scope=\"row\">" + name + "</th>" +
                "<td>" + destination + "</td>>" +
                "<td>" + arrivalFrequency + "</td>>" +
                "<td>" + nextTrainTime + "</td>>" +
                "<td>" + minutesUntilNextArrival + "</td>>" +
                "<td class=\"editOptionsTD\">" +
                "<span>" +
                "<i class=\"fas fa-edit edit\"></i>" +
                "<i class=\"fas fa-trash-alt delete\"></i>" +
                "</span>" +
                "</td>" +
                "</tr>");
        });
    }, function (errorObject) {
        modalErrorMsg.text("Errors handled: " + errorObject.code);
        modal.modal("show");
    });

    // Eventhandler for update
    database.ref().child("data/trainSchedule/").orderByChild("dateAdded").on("child_changed", function (childSnapshot) {
        let childKey = childSnapshot.key;
        let childData = childSnapshot.val();

        let name = childData.name;
        let destination = childData.destination;
        let firstTrainTime = childData.firstTrainTime;
        let arrivalFrequency = childData.arrivalFrequency;

        let nextArrival = calculateNextArrival(firstTrainTime, arrivalFrequency);
        let minutesUntilNextArrival = nextArrival[0];
        let nextTrainTime = nextArrival[1];

        $("#" + childKey).html(
            "<tr id=\"" + childKey + "\">" +
            "<th scope=\"row\">" + name + "</th>" +
            "<td>" + destination + "</td>>" +
            "<td>" + arrivalFrequency + "</td>>" +
            "<td>" + nextTrainTime + "</td>>" +
            "<td>" + minutesUntilNextArrival + "</td>>" +
            "<td>" +
            "<span>" +
            "<i class=\"fas fa-edit edit\"></i>" +
            "<i class=\"fas fa-trash-alt delete\"></i>" +
            "</span>" +
            "</td>" +
            "</tr>");
    }, function (errorObject) {
        modalErrorMsg.text("Errors handled: " + errorObject.code);
        modal.modal("show");
    });

    // FX to calculate upcoming arrival and remaining time
    function calculateNextArrival(firstTrainTime, arrivalFrequency) {
        let firstTrainTimeConverted = moment.unix(firstTrainTime).subtract(1, "years");
        let diffTime = moment().diff(moment(firstTrainTimeConverted), "minutes");
        let tRemainder = diffTime % arrivalFrequency;
        let tMinutesUntilNextArrival = arrivalFrequency - tRemainder;
        let nextTrainTime = moment().add(tMinutesUntilNextArrival, "minutes").format("HH:mm A");

        return [tMinutesUntilNextArrival, nextTrainTime];
    }

    // Edit event
    $(document).on("click", ".edit", function () {
        let oId = $(this).closest("tr").attr("id");
        database.ref("data/trainSchedule/" + oId).once("value").then(function (childSnapshot) {
            $("#inputId").val(childSnapshot.key);
            $("#inputName").val(childSnapshot.val().name);
            $("#inputDestination").val(childSnapshot.val().destination);
            $("#inputFirstTrainTime").val(moment.unix(childSnapshot.val().firstTrainTime).format("HH:mm"));
            $("#inputArrivalFrequency").val(childSnapshot.val().arrivalFrequency);
        });
    });

    // Delete event
    $(document).on("click", ".delete", function () {
        let oId = $(this).closest("tr").attr("id");
        database.ref("data/trainSchedule/" + oId).remove();
        $("#" + oId).remove();
    });
});