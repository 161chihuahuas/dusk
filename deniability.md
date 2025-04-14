# [🝰 dusk](https://rundusk.org)
# *deniability as a security property*
## --

Cloud storage providers have a business incentive to provide availability, durability, and speed. Sometimes providers market privacy and end-to-end encryption, but the concept of deniability is unheard of in the cloud services sector. So, why is that?

The simple answer: they can't offer it to you.

Cloud business are just data landlords - buying up servers and gobbling up bandwidth while charging you rent to store your files. Can't pay? Goodbye photos. Legal subpeona? Now your data landlord is a snitch.

The idea of deniability comes from a threat model in which, at any moment, your device could be seized by authorities or stolen by non-state adversaries. If you or your data host(s) are compromised, can that data be accessed? Can it be proven that it existed?

Dusk is designed to be able to answer **no**.

Traditional security models, especially multi-factor authentication, rely on choosing multiple pieces of secret information. Usually, *something you have*, such as a phone, and *something you know*, like a password. 

Sometimes a third factor (or most often interchanged with one of the previous two) is *something you are* - referring to biometric input. However, this factor is trivial to bypass if you have been detained and can be coerced.

Dusk introduces a different piece of secret information to be used as a factor: **affinity** or *something mutual*. Companies will comply with state, but dusk networks are ephemeral and can be burned and rebuilt by m-of-n group members without revealing those members.

This introduces a security model in the spirit of "we keep us safe" - through our relationships. Dusk requires human coordination and affinity. It's a proven security model: "if nobody talks, everybody walks".

Except in this case, there is nothing to talk about because group members do not have any knowledge of what is stored on their computer. 

Deniable means that access can be denied. Cloud companies may not be able to deny access to state adversaries. But your affinity network can - through anonymity ("You dont know who or where I am"), willfull noncompliance ("I wont comply with a subpeona"), and plausible deniability ("Because it cannot be determined if I have what you are looking for).

With dusk, device seizure and personal compromise alone cannot prove that a file exists or existed. An adversary would need:

* M-of-N host computers in the dusk network
* M-of-N airgapped metadata USB drives
* M-of-N user passphrases for dusk
* M-on-N user passphrases for airgapped metadata 
* M-of-N user OTP secrets (phone, security key, etc)

Dusk is designed be able to *deny* access to data and give group members *deniability* that they have any knowledge or access to data they are storing. Unlike other decentralized cloud networks, dusk not secured by money or inventivized through economic models. It is secured through affinity via human relationships, ephemeral identities, and strong cryptography.

In short, **dusk doesn't talk to cops**.