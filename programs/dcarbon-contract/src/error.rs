use anchor_lang::error_code;

#[error_code]
pub enum DCarbonError {
    #[msg("PublicKey Mismatch")]
    PublicKeyMismatch,

    InvalidProjectId,

    #[msg("Master account is already init")]
    MasterIsAlreadyInit,

    #[msg("Admin account is already init")]
    AdminIsAlreadyInit,

    #[msg("Contract config account is already init")]
    ContractConfigIsAlreadyInit,

    #[msg("Must active this device to mint semi-fungible token")]
    DeviceIsNotActive,

    SigVerificationFailed,

    #[msg("Init config for contract is invalid")]
    InitArgsInvalid,

    InvalidNonce,

    NotMintTime,

    NotEnoughAmount,

    InvalidMint,

    InvalidAmount,

    InvalidValue,

    InvalidStringLength,

    InvalidNumber,

    InvalidDeviceId,

    InvalidDeviceType,

    DontHaveEnoughAmountToClaim
}